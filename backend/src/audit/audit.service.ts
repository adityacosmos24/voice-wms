// ─── Audit Service ──────────────────────────────────────────────────────────
// Append-only logging to the audit_log table.
// Every state transition, every command, every action gets a row.
// You never update or delete a row — a revert is a new row.

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../database/schemas/audit-log.schema';
import { Command, CommandDocument } from '../database/schemas/command.schema';
import { Action, ActionDocument } from '../database/schemas/action.schema';
import { Session, SessionDocument } from '../database/schemas/session.schema';
import { EventType } from '../common/types/command.types';

export interface AuditFeedFilters {
  warehouseId?: string;
  userId?: string;
  zone?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface AuditFeedItem {
  id: string;
  commandId: string;
  transcript: string | null;
  parsedIntent: unknown;
  status: string;
  sttConfidence: number | null;
  validationResult: unknown;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    role: string;
  };
  actions: Array<{
    id: string;
    actionType: string;
    payload: unknown;
    inversePayload: unknown;
    executedAt: Date | null;
    revertedAt: Date | null;
    revertedByActionId: string | null;
  }>;
  auditEvents: Array<{
    id: string;
    eventType: string;
    detail: unknown;
    createdAt: Date;
  }>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Command.name) private commandModel: Model<CommandDocument>,
    @InjectModel(Action.name) private actionModel: Model<ActionDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {}

  /**
   * Log an event to the audit log (append-only).
   */
  async logEvent(
    commandId: string | null,
    actionId: string | null,
    actorUserId: string,
    eventType: EventType,
    detail?: Record<string, unknown>,
  ) {
    const log = new this.auditLogModel({
      commandId,
      actionId,
      actorUserId,
      eventType,
      detail: detail ?? {},
    });
    await log.save();
    return log;
  }

  /**
   * Get the full event timeline for a command.
   */
  async getCommandHistory(commandId: string) {
    return this.auditLogModel
      .find({ commandId })
      .sort({ createdAt: 1 })
      .populate('actorUserId', 'name role')
      .exec();
  }

  /**
   * Get the paginated audit feed with filters.
   * This powers the dashboard's main view.
   */
  async getFeed(filters: AuditFeedFilters): Promise<{
    items: AuditFeedItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.$lte = filters.dateTo;
    }

    let sessionQuery: any = null;
    if (filters.warehouseId) {
        sessionQuery = { warehouseId: filters.warehouseId };
    }
    
    // Fetch sessions if there is a warehouse filter
    let sessionIds = [];
    if (sessionQuery) {
        const sessions = await this.sessionModel.find(sessionQuery).select('_id').exec();
        sessionIds = sessions.map(s => s._id);
        where.sessionId = { $in: sessionIds };
    }

    const total = await this.commandModel.countDocuments(where).exec();
    const commands = await this.commandModel
      .find(where)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'sessionId',
        populate: { path: 'userId', select: 'name role' }
      })
      .exec();

    const commandIds = commands.map(cmd => cmd._id);

    const [allActions, allAuditLogs] = await Promise.all([
      this.actionModel.find({ commandId: { $in: commandIds.map(id => id.toString()) as any } }).sort({ executedAt: 1 }).exec(),
      this.auditLogModel.find({ commandId: { $in: commandIds.map(id => id.toString()) as any } }).sort({ createdAt: 1 }).exec(),
    ]);

    const items: AuditFeedItem[] = commands.map((cmd) => {
      const actions = allActions.filter(a => a.commandId.toString() === cmd._id.toString());
      const auditLogs = allAuditLogs.filter(l => l.commandId?.toString() === cmd._id.toString());
      const session = cmd.sessionId as any;
      const user = session?.userId;

      return {
        id: cmd._id.toString(),
        commandId: cmd._id.toString(),
        transcript: cmd.transcript ?? null,
        parsedIntent: cmd.parsedIntent,
        status: cmd.status,
        sttConfidence: cmd.sttConfidence ?? null,
        validationResult: cmd.validationResult,
        createdAt: (cmd as any).createdAt,
        user: user ? {
          id: user._id.toString(),
          name: user.name,
          role: user.role,
        } : { id: '', name: 'Unknown', role: 'unknown' },
        actions: actions.map(a => ({
          id: a._id.toString(),
          actionType: a.actionType,
          payload: a.payload,
          inversePayload: a.inversePayload,
          executedAt: a.executedAt ?? null,
          revertedAt: a.revertedAt ?? null,
          revertedByActionId: a.revertedByActionId?.toString() ?? null,
        })),
        auditEvents: auditLogs.map(l => ({
          id: l._id.toString(),
          eventType: l.eventType,
          detail: l.detail,
          createdAt: (l as any).createdAt,
        })),
      };
    });

    return { items, total, page, limit };
  }

  /**
   * Get a single command with full detail for the expanded view.
   */
  async getCommandDetail(commandId: string): Promise<AuditFeedItem | null> {
    const cmd = await this.commandModel
      .findById(commandId)
      .populate({
        path: 'sessionId',
        populate: { path: 'userId', select: 'name role' }
      })
      .exec();

    if (!cmd) return null;

    const [actions, auditLogs] = await Promise.all([
      this.actionModel.find({ commandId }).sort({ executedAt: 1 }).exec(),
      this.auditLogModel.find({ commandId }).sort({ createdAt: 1 }).exec(),
    ]);

    const session = cmd.sessionId as any;
    const user = session?.userId;

    return {
      id: cmd._id.toString(),
      commandId: cmd._id.toString(),
      transcript: cmd.transcript ?? null,
      parsedIntent: cmd.parsedIntent,
      status: cmd.status,
      sttConfidence: cmd.sttConfidence ?? null,
      validationResult: cmd.validationResult,
      createdAt: (cmd as any).createdAt,
      user: user ? {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
      } : { id: '', name: 'Unknown', role: 'unknown' },
      actions: actions.map(a => ({
        id: a._id.toString(),
        actionType: a.actionType,
        payload: a.payload,
        inversePayload: a.inversePayload,
        executedAt: a.executedAt ?? null,
        revertedAt: a.revertedAt ?? null,
        revertedByActionId: a.revertedByActionId?.toString() ?? null,
      })),
      auditEvents: auditLogs.map(l => ({
        id: l._id.toString(),
        eventType: l.eventType,
        detail: l.detail,
        createdAt: (l as any).createdAt,
      })),
    };
  }
}
