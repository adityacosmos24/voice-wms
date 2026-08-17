// ─── State Machine ──────────────────────────────────────────────────────────
// Enforced state transitions for the command lifecycle.
// Every transition is a natural log event — this makes the audit log trivial.

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Command, CommandDocument } from '../database/schemas/command.schema';
import { AuditLog, AuditLogDocument } from '../database/schemas/audit-log.schema';
import {
  CommandStatus,
  VALID_TRANSITIONS,
  isValidTransition,
  isTerminalState,
  EventType,
} from '../common/types/command.types';

export class InvalidTransitionError extends BadRequestException {
  constructor(from: CommandStatus, to: CommandStatus) {
    super(
      `Invalid state transition: ${from} → ${to}. ` +
      `Valid transitions from '${from}': [${VALID_TRANSITIONS[from].join(', ')}]`,
    );
  }
}

@Injectable()
export class CommandStateMachine {
  constructor(
    @InjectModel(Command.name) private commandModel: Model<CommandDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Transition a command to a new status.
   * Validates the transition is legal, updates the command, and returns the updated record.
   * Throws InvalidTransitionError if the transition is not allowed.
   */
  async transition(
    commandId: string,
    targetStatus: CommandStatus,
    actorUserId: string,
    detail?: Record<string, unknown>,
  ) {
    // Fetch current command status
    const command = await this.commandModel.findById(commandId).exec();
    
    if (!command) {
        throw new BadRequestException(`Command '${commandId}' not found.`);
    }

    const currentStatus = command.status as CommandStatus;

    // Enforce state machine
    if (isTerminalState(currentStatus)) {
      throw new BadRequestException(
        `Command ${commandId} is in terminal state '${currentStatus}' — no further transitions allowed.`,
      );
    }

    if (!isValidTransition(currentStatus, targetStatus)) {
      throw new InvalidTransitionError(currentStatus, targetStatus);
    }

    // Update command status
    const updated = await this.commandModel.findByIdAndUpdate(
      commandId,
      { $set: { status: targetStatus } },
      { new: true }
    ).exec();

    // Map CommandStatus to EventType for audit logging
    const eventTypeMap: Partial<Record<CommandStatus, EventType>> = {
      [CommandStatus.PARSED]: EventType.PARSED,
      [CommandStatus.VALIDATED]: EventType.VALIDATED,
      [CommandStatus.CONFIRMED]: EventType.CONFIRMED,
      [CommandStatus.EXECUTED]: EventType.EXECUTED,
      [CommandStatus.REJECTED]: EventType.REJECTED,
      [CommandStatus.REVERTED]: EventType.REVERTED,
    };

    const eventType = eventTypeMap[targetStatus];

    // Create audit log entry for this transition
    if (eventType) {
      const auditLog = new this.auditLogModel({
        commandId,
        actorUserId,
        eventType,
        detail: {
          from: currentStatus,
          to: targetStatus,
          ...detail,
        },
      });
      await auditLog.save();
    }

    return updated;
  }

  /**
   * Get the current status of a command.
   */
  async getStatus(commandId: string): Promise<CommandStatus> {
    const command = await this.commandModel.findById(commandId).exec();
    if (!command) {
        throw new BadRequestException(`Command '${commandId}' not found.`);
    }
    return command.status as CommandStatus;
  }

  /**
   * Get valid next states for a command.
   */
  async getValidNextStates(commandId: string): Promise<CommandStatus[]> {
    const status = await this.getStatus(commandId);
    return VALID_TRANSITIONS[status] ?? [];
  }
}
