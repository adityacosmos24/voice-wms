// ─── Revert Service ─────────────────────────────────────────────────────────
// Executes compensating actions to undo previously executed commands.
// Reverting is itself a logged, audited action — it doesn't delete history.

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Action, ActionDocument } from '../database/schemas/action.schema';
import { Command, CommandDocument } from '../database/schemas/command.schema';
import { User, UserDocument } from '../database/schemas/user.schema';
import { AuditService } from './audit.service';
import { CommandStatus, EventType, ActionType } from '../common/types/command.types';
import { ROLE_PERMISSIONS } from '../common/types/validation.types';
import { GoodsReceiptTool } from '../execution/tools/goods-receipt.tool';
import { PickTool } from '../execution/tools/pick.tool';
import { AdjustInventoryTool } from '../execution/tools/adjust-inventory.tool';
import { LogDamageTool } from '../execution/tools/log-damage.tool';
import { MoveStockTool } from '../execution/tools/move-stock.tool';

@Injectable()
export class RevertService {
  constructor(
    @InjectModel(Action.name) private actionModel: Model<ActionDocument>,
    @InjectModel(Command.name) private commandModel: Model<CommandDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
    private readonly goodsReceiptTool: GoodsReceiptTool,
    private readonly pickTool: PickTool,
    private readonly adjustInventoryTool: AdjustInventoryTool,
    private readonly logDamageTool: LogDamageTool,
    private readonly moveStockTool: MoveStockTool,
  ) {}

  /**
   * Revert an executed action using its stored compensating (inverse) payload.
   */
  async revertAction(
    actionId: string,
    userId: string,
  ): Promise<{ success: boolean; revertActionId: string }> {
    // 1. Fetch the action
    const action = await this.actionModel.findById(actionId).exec();

    if (!action) {
      throw new BadRequestException(`Action '${actionId}' not found.`);
    }

    // 2. Check not already reverted
    if (action.revertedAt) {
      throw new BadRequestException(
        `Action '${actionId}' has already been reverted at ${action.revertedAt.toISOString()}. ` +
        `Double-revert is not allowed.`,
      );
    }

    // 3. Check inverse payload exists
    if (!action.inversePayload) {
      throw new BadRequestException(
        `Action '${actionId}' has no compensating action stored. Revert is not possible.`,
      );
    }

    // 4. Check permission — user must have undo_last permission
    const user = await this.userModel.findById(userId).exec();
    
    if (!user) {
        throw new BadRequestException(`User not found.`);
    }

    const allowedIntents = user ? ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] : undefined;
    if (!allowedIntents?.includes('undo_last')) {
      throw new ForbiddenException(
        `User role '${user.role}' does not have permission to revert actions.`,
      );
    }

    // 5. Execute the compensating action
    const inversePayload = action.inversePayload as Record<string, unknown>;

    await this.executeInverse(action.actionType as ActionType, inversePayload);

    // 6. Create a new Action record for the reversal
    const revertAction = new this.actionModel({
      commandId: action.commandId,
      actionType: ActionType.REVERT,
      payload: {
        originalActionId: actionId,
        originalActionType: action.actionType,
        inversePayload: inversePayload as any,
      },
      inversePayload: null,
      executedAt: new Date(),
    });
    
    await revertAction.save();

    // 7. Update original action with revert info
    await this.actionModel.findByIdAndUpdate(actionId, {
      $set: {
        revertedAt: new Date(),
        revertedByActionId: revertAction._id,
      }
    }).exec();

    // 8. Transition command status to reverted
    await this.commandModel.findByIdAndUpdate(action.commandId, {
      $set: { status: CommandStatus.REVERTED }
    }).exec();

    // 9. Log the revert event
    await this.auditService.logEvent(
      action.commandId.toString(),
      revertAction._id.toString(),
      userId,
      EventType.REVERTED,
      {
        originalActionId: actionId,
        originalActionType: action.actionType,
        inversePayload,
      },
    );

    return { success: true, revertActionId: revertAction._id.toString() };
  }

  /**
   * Check if an action can be reverted — used by the dashboard to enable/disable
   * the revert button and show a tooltip reason.
   */
  async canRevert(
    actionId: string,
    userId: string,
  ): Promise<{ canRevert: boolean; reason?: string }> {
    const action = await this.actionModel.findById(actionId).exec();

    if (!action) {
      return { canRevert: false, reason: 'Action not found.' };
    }

    if (action.revertedAt) {
      return { canRevert: false, reason: 'Action has already been reverted.' };
    }

    if (!action.inversePayload) {
      return { canRevert: false, reason: 'No compensating action available.' };
    }

    const user = await this.userModel.findById(userId).exec();

    const allowedIntents = user ? ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] : undefined;
    if (!allowedIntents?.includes('undo_last')) {
      return {
        canRevert: false,
        reason: `Role '${user?.role}' does not have revert permission.`,
      };
    }

    return { canRevert: true };
  }

  // ─── Execute inverse operation based on action type ───────────────────────

  private async executeInverse(
    actionType: ActionType,
    inversePayload: Record<string, unknown>,
  ): Promise<void> {
    switch (actionType) {
      case ActionType.CREATE_GOODS_RECEIPT:
        await this.goodsReceiptTool.revert(inversePayload as any);
        break;
      case ActionType.PICK_STOCK:
        await this.pickTool.revert(inversePayload as any);
        break;
      case ActionType.ADJUST_INVENTORY:
      case ActionType.CYCLE_COUNT:
        await this.adjustInventoryTool.revert(inversePayload as any);
        break;
      case ActionType.LOG_DAMAGE:
        await this.logDamageTool.revert(inversePayload as any);
        break;
      case ActionType.MOVE_STOCK:
        await this.moveStockTool.revert(inversePayload as any);
        break;
      default:
        throw new BadRequestException(
          `Cannot revert action type '${actionType}'.`,
        );
    }
  }
}
