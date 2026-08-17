// ─── Orchestrator Service ───────────────────────────────────────────────────
// The main pipeline entry point. Every command flows through here:
// parse → validate → confirm (if needed) → execute → log
//
// This service owns the state transitions and coordinates all modules.

import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Command, CommandDocument } from '../database/schemas/command.schema';
import { User, UserDocument } from '../database/schemas/user.schema';
import { Action, ActionDocument } from '../database/schemas/action.schema';
import { CommandStateMachine } from './state-machine';
import { ValidationService } from '../validation/validation.service';
import { ExecutionService } from '../execution/execution.service';
import { AuditService } from '../audit/audit.service';
import { RevertService } from '../audit/revert.service';
import { AuditGateway } from '../audit/audit.gateway';
import { SessionService } from '../session/session.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { VoiceService } from '../voice/voice.service';
import { IntentService } from '../intent/intent.service';
import {
  CommandStatus,
  EventType,
  type TextCommandInput,
} from '../common/types/command.types';
import {
  ParsedIntentSchema,
  type ParsedIntent,
  IntentType,
} from '../common/types/intent.types';
import { ValidationDecision } from '../common/types/validation.types';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @InjectModel(Command.name) private commandModel: Model<CommandDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Action.name) private actionModel: Model<ActionDocument>,
    private readonly stateMachine: CommandStateMachine,
    private readonly validationService: ValidationService,
    private readonly executionService: ExecutionService,
    private readonly auditService: AuditService,
    private readonly revertService: RevertService,
    private readonly auditGateway: AuditGateway,
    private readonly sessionService: SessionService,
    private readonly warehouseService: WarehouseService,
    private readonly voiceService: VoiceService,
    private readonly intentService: IntentService,
  ) {}

  /**
   * Process a text command (Phase 1 entry point).
   * Accepts a pre-structured intent object — no LLM needed.
   */
  async processTextCommand(input: TextCommandInput) {
    return this.processCommandBase(input.sessionId, input.text, null);
  }

  /**
   * Process a voice command (Phase 2 entry point).
   * 1. Audio -> STT -> Transcript
   * 2. Transcript -> LLM -> ParsedIntent
   * 3. Resume common pipeline
   */
  async processVoiceCommand(sessionId: string, audioBuffer: Buffer, mimetype: string) {
    const session = await this.sessionService.getSession(sessionId);
    
    // 1. Voice to Text
    const transcriptResult = await this.voiceService.transcribe(audioBuffer, mimetype);
    
    // 2. Extract Intent
    const context = await this.warehouseService.buildSessionContext(
      sessionId,
      session.userId.toString(),
      session.warehouseId.toString(),
    );
    const parsedIntent = await this.intentService.extractIntent(
      transcriptResult.text,
      context,
    );
    
    // Override STT confidence from Deepgram
    parsedIntent.confidence = transcriptResult.overallConfidence;

    return this.processCommandBase(sessionId, transcriptResult.text, parsedIntent);
  }

  /**
   * Common pipeline for both text and voice.
   */
  private async processCommandBase(
    sessionId: string,
    transcript: string,
    preParsedIntent: ParsedIntent | null,
  ) {
    const session = await this.sessionService.getSession(sessionId);
    const userId = session.userId.toString();
    const warehouseId = session.warehouseId.toString();

    // 1. Create command record (status: received)
    const command = new this.commandModel({
      sessionId,
      transcript,
      status: CommandStatus.RECEIVED,
    });
    await command.save();

    this.logger.log(`Command ${command._id} created: ${transcript}`);

    try {
      let parsedIntent: ParsedIntent;
      
      if (preParsedIntent) {
        parsedIntent = preParsedIntent;
      } else {
        // Phase 1 fallback: parse text as JSON
        try {
          const parsed = JSON.parse(transcript);
          parsedIntent = ParsedIntentSchema.parse(parsed);
        } catch {
          await this.stateMachine.transition(
            command._id.toString(),
            CommandStatus.REJECTED,
            userId,
            { reason: 'Failed to parse intent from text input.' },
          );
          this.auditGateway.emitCommandStatusChange(
            command._id.toString(),
            CommandStatus.REJECTED,
          );
          return {
            commandId: command._id.toString(),
            status: CommandStatus.REJECTED,
            reason: 'Failed to parse intent. Expected valid JSON matching ParsedIntent schema.',
          };
        }
      }

      // Update command with parsed intent
      await this.commandModel.findByIdAndUpdate(command._id, {
        $set: {
          parsedIntent: parsedIntent as any,
          entityConfidence: parsedIntent.confidence,
        }
      }).exec();

      // Transition: received → parsed
      await this.stateMachine.transition(
        command._id.toString(),
        CommandStatus.PARSED,
        userId,
        { parsedIntent },
      );

      // 3. Run validation pipeline
      const user = await this.userModel.findById(userId).exec();
      if (!user) throw new NotFoundException('User not found');

      const { result: validationResult, decision } =
        await this.validationService.validate(
          parsedIntent,
          warehouseId,
          user.role,
          null, // No STT confidence for text input
        );

      // Update command with validation result
      await this.commandModel.findByIdAndUpdate(command._id, {
        $set: { validationResult: validationResult as any }
      }).exec();

      // Transition: parsed → validated
      await this.stateMachine.transition(
        command._id.toString(),
        CommandStatus.VALIDATED,
        userId,
        { validationResult, decision },
      );

      // 4. Decision gate
      switch (decision) {
        case ValidationDecision.REJECT: {
          await this.stateMachine.transition(
            command._id.toString(),
            CommandStatus.REJECTED,
            userId,
            { reason: 'Validation failed', validationResult },
          );
          this.auditGateway.emitCommandStatusChange(
            command._id.toString(),
            CommandStatus.REJECTED,
            validationResult,
          );
          return {
            commandId: command._id.toString(),
            status: CommandStatus.REJECTED,
            validationResult,
          };
        }

        case ValidationDecision.CONFIRM: {
          await this.stateMachine.transition(
            command._id.toString(),
            CommandStatus.PENDING_CONFIRMATION,
            userId,
            {
              reason: validationResult.confirmationReason,
              validationResult,
            },
          );
          // Push confirmation request via WebSocket
          this.auditGateway.emitConfirmationRequired(command._id.toString(), {
            parsedIntent,
            confirmationReason: validationResult.confirmationReason,
            prompt: this.generateConfirmationPrompt(parsedIntent),
          });
          return {
            commandId: command._id.toString(),
            status: CommandStatus.PENDING_CONFIRMATION,
            confirmationReason: validationResult.confirmationReason,
            prompt: this.generateConfirmationPrompt(parsedIntent),
            validationResult,
          };
        }

        case ValidationDecision.APPROVE: {
          // Auto-approve: execute directly
          await this.auditService.logEvent(
            command._id.toString(),
            null,
            userId,
            EventType.AUTO_APPROVED,
            { reason: 'High confidence, low impact — auto-approved' },
          );

          return this.executeCommand(
            command._id.toString(),
            parsedIntent,
            warehouseId,
            validationResult.resolvedEntities || {},
            userId,
          );
        }

        default:
          throw new BadRequestException(`Unexpected validation decision: ${decision}`);
      }
    } catch (error) {
      this.logger.error(`Command ${command._id} failed: ${error}`);
      throw error;
    }
  }

  /**
   * Confirm a pending command and execute it.
   */
  async confirmCommand(commandId: string, userId: string) {
    const command = await this.commandModel.findById(commandId).populate('sessionId').exec();

    if (!command) throw new NotFoundException('Command not found');

    if ((command.status as unknown as CommandStatus) !== CommandStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException(
        `Command ${commandId} is not pending confirmation (status: ${command.status}).`,
      );
    }

    // Transition: pending_confirmation → confirmed
    await this.stateMachine.transition(
      commandId,
      CommandStatus.CONFIRMED,
      userId,
    );

    const parsedIntent = command.parsedIntent as unknown as ParsedIntent;

    // Re-run validation to get resolved entities
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const session = command.sessionId as any;

    const { result: validationResult } = await this.validationService.validate(
      parsedIntent,
      session.warehouseId.toString(),
      user.role,
      command.sttConfidence ?? null,
    );

    // Execute
    return this.executeCommand(
      commandId,
      parsedIntent,
      session.warehouseId.toString(),
      validationResult.resolvedEntities || {},
      userId,
    );
  }

  /**
   * Reject a pending command.
   */
  async rejectCommand(commandId: string, userId: string, reason?: string) {
    const command = await this.commandModel.findById(commandId).exec();
    
    if (!command) throw new NotFoundException('Command not found');

    if ((command.status as unknown as CommandStatus) !== CommandStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException(
        `Command ${commandId} is not pending confirmation (status: ${command.status}).`,
      );
    }

    await this.stateMachine.transition(
      commandId,
      CommandStatus.REJECTED,
      userId,
      { reason: reason ?? 'Rejected by user' },
    );

    this.auditGateway.emitCommandStatusChange(commandId, CommandStatus.REJECTED, { reason });

    return { commandId, status: CommandStatus.REJECTED, reason };
  }

  /**
   * Revert an executed action.
   */
  async revertAction(actionId: string, userId: string) {
    const result = await this.revertService.revertAction(actionId, userId);
    this.auditGateway.emitRevert(actionId, result);
    return result;
  }

  /**
   * Check if an action can be reverted.
   */
  async canRevert(actionId: string, userId: string) {
    return this.revertService.canRevert(actionId, userId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Execute a validated command through the execution adapter.
   */
  private async executeCommand(
    commandId: string,
    parsedIntent: ParsedIntent,
    warehouseId: string,
    resolvedEntities: Record<string, unknown>,
    userId: string,
  ) {
    // Handle UNDO_LAST specially
    if (parsedIntent.intent === IntentType.UNDO_LAST) {
      const entities = parsedIntent.entities as Record<string, unknown>;
      if (entities.action_id) {
        const result = await this.revertAction(
          String(entities.action_id),
          userId,
        );
        await this.stateMachine.transition(
          commandId,
          CommandStatus.EXECUTED,
          userId,
          { revertResult: result },
        );
        return { commandId, status: CommandStatus.EXECUTED, result };
      } else {
        // Find the last executed action for this user's session
        // In Mongoose this is a bit trickier, we need actions whose command belongs to a session with userId
        // So we first find commands for the user
        const sessions = await this.sessionService.getActiveSession(userId); // wait, it might not be the active one.
        // Actually find commands by sessions of this user
        // But for simplicity, we can query commands:
        // Or we can just use the audit logs or simply get the commands by the user's sessions.
        // But the previous query was: action -> command -> session -> userId.
        // Let's do it in two steps.
        const userSessions = await this.sessionService['sessionModel'].find({ userId }).select('_id').exec();
        const userSessionIds = userSessions.map(s => s._id);
        const userCommands = await this.commandModel.find({ sessionId: { $in: userSessionIds.map(id => id.toString()) as any } }).select('_id').exec();
        const userCommandIds = userCommands.map(c => c._id);

        const lastAction = await this.actionModel.findOne({
          commandId: { $in: userCommandIds.map(id => id.toString()) as any },
          revertedAt: null,
          executedAt: { $ne: null },
        }).sort({ executedAt: -1 }).exec();

        if (!lastAction) {
          throw new BadRequestException('No recent action found to undo.');
        }

        const result = await this.revertAction(lastAction._id.toString(), userId);
        await this.stateMachine.transition(
          commandId,
          CommandStatus.EXECUTED,
          userId,
          { revertResult: result },
        );
        return { commandId, status: CommandStatus.EXECUTED, result };
      }
    }

    // Execute through the execution service
    const execResult = await this.executionService.execute(
      commandId,
      parsedIntent,
      warehouseId,
      resolvedEntities,
    );

    // Transition: validated/confirmed → executed
    await this.stateMachine.transition(
      commandId,
      CommandStatus.EXECUTED,
      userId,
      { actionId: execResult.actionId, result: execResult.result },
    );

    // Push to dashboard
    const commandDetail = await this.auditService.getCommandDetail(commandId);
    if (commandDetail) {
      this.auditGateway.emitNewCommand(commandDetail);
    }
    this.auditGateway.emitCommandStatusChange(
      commandId,
      CommandStatus.EXECUTED,
      execResult,
    );

    return {
      commandId,
      status: CommandStatus.EXECUTED,
      action: execResult,
    };
  }

  /**
   * Generate a human-readable confirmation prompt.
   */
  private generateConfirmationPrompt(parsedIntent: ParsedIntent): string {
    const entities = parsedIntent.entities as Record<string, unknown>;

    switch (parsedIntent.intent) {
      case IntentType.GOODS_RECEIPT:
        return `Confirm: Receive ${entities.quantity_good} good units` +
          (entities.quantity_damaged ? ` and ${entities.quantity_damaged} damaged` : '') +
          ` of SKU ${entities.sku} into ${entities.location}?`;

      case IntentType.PICK:
        return `Confirm: Pick ${entities.quantity} units of SKU ${entities.sku} from ${entities.location}?`;

      case IntentType.PUTAWAY:
        return `Confirm: Put away ${entities.quantity} units of SKU ${entities.sku} to ${entities.destination_location}?`;

      case IntentType.CYCLE_COUNT:
        return `Confirm: Set count for SKU ${entities.sku} at ${entities.location} to ${entities.quantity_good} good, ${entities.quantity_damaged ?? 0} damaged?`;

      case IntentType.DAMAGE_REPORT:
        return `Confirm: Report ${entities.quantity} damaged units of SKU ${entities.sku} at ${entities.location}?`;

      case IntentType.TRANSFER:
        return `Confirm: Transfer ${entities.quantity} units of SKU ${entities.sku} from ${entities.source_location} to ${entities.destination_location}?`;

      case IntentType.UNDO_LAST:
        return 'Confirm: Undo the last action?';

      default:
        return `Confirm: Execute ${parsedIntent.intent}?`;
    }
  }
}
