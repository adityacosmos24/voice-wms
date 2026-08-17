export const CommandStatus = {
  RECEIVED: 'received',
  PARSED: 'parsed',
  VALIDATED: 'validated',
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  EXECUTED: 'executed',
  REJECTED: 'rejected',
  REVERTED: 'reverted',
} as const;

export type CommandStatus = typeof CommandStatus[keyof typeof CommandStatus];

export const EventType = {
  PARSED: 'parsed',
  VALIDATED: 'validated',
  CONFIRMED: 'confirmed',
  EXECUTED: 'executed',
  REJECTED: 'rejected',
  REVERTED: 'reverted',
  AUTO_APPROVED: 'auto_approved',
} as const;

export type EventType = typeof EventType[keyof typeof EventType];

export interface User {
  id: string;
  name: string;
  role: string;
}

export interface Command {
  id: string;
  sessionId: string;
  transcript?: string;
  sttConfidence?: number;
  parsedIntent?: Record<string, any>;
  entityConfidence?: number;
  validationResult?: Record<string, any>;
  status: CommandStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Action {
  id: string;
  commandId: string;
  actionType: string;
  payload: Record<string, any>;
  inversePayload?: Record<string, any>;
  executedAt?: string;
  revertedAt?: string;
  revertedByActionId?: string;
}

export interface AuditLog {
  id: string;
  commandId?: string;
  actionId?: string;
  actorUserId: string;
  eventType: EventType;
  detail?: Record<string, any>;
  createdAt: string;
  actor?: User;
  command?: Command;
  action?: Action;
}

export interface CommandDetail extends Command {
  actions: Action[];
  auditLogs: AuditLog[];
}
