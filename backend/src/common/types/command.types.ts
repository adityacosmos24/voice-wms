// ─── Command Types & State Machine Definition ──────────────────────────────
// Every command flows through a strict state machine. Transitions are enforced
// in code — not implied by which function gets called.

/**
 * Command status — mirrors the Prisma CommandStatus enum.
 * This is the canonical state machine for every command lifecycle.
 */
export enum CommandStatus {
  RECEIVED = 'received',
  PARSED = 'parsed',
  VALIDATED = 'validated',
  PENDING_CONFIRMATION = 'pending_confirmation',
  CONFIRMED = 'confirmed',
  EXECUTED = 'executed',
  REJECTED = 'rejected',
  REVERTED = 'reverted',
}

/**
 * Valid state transitions. Each key maps to the set of states it can transition TO.
 *
 * received → parsed → validated ─┬─→ rejected (end)
 *                                 ├─→ pending_confirmation → confirmed → executed → reverted
 *                                 └─→ executed (auto-approved)
 */
export const VALID_TRANSITIONS: Record<CommandStatus, CommandStatus[]> = {
  [CommandStatus.RECEIVED]: [CommandStatus.PARSED, CommandStatus.REJECTED],
  [CommandStatus.PARSED]: [CommandStatus.VALIDATED, CommandStatus.REJECTED],
  [CommandStatus.VALIDATED]: [
    CommandStatus.PENDING_CONFIRMATION,
    CommandStatus.EXECUTED,       // auto-approved path
    CommandStatus.REJECTED,
  ],
  [CommandStatus.PENDING_CONFIRMATION]: [
    CommandStatus.CONFIRMED,
    CommandStatus.REJECTED,
  ],
  [CommandStatus.CONFIRMED]: [CommandStatus.EXECUTED, CommandStatus.REJECTED],
  [CommandStatus.EXECUTED]: [CommandStatus.REVERTED],
  [CommandStatus.REJECTED]: [],   // terminal state
  [CommandStatus.REVERTED]: [],   // terminal state
};

/**
 * Check whether a state transition is legal.
 */
export function isValidTransition(from: CommandStatus, to: CommandStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Terminal states — no further transitions allowed.
 */
export function isTerminalState(status: CommandStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}

// ─── Auto-approve thresholds ────────────────────────────────────────────────

export interface AutoApproveConfig {
  /** Minimum STT confidence to skip confirmation (0-1) */
  minSttConfidence: number;
  /** Minimum entity match confidence to skip confirmation (0-1) */
  minEntityConfidence: number;
  /** Maximum quantity change that can be auto-approved */
  maxAutoApproveQuantity: number;
  /** Intent types that always require confirmation regardless of confidence */
  alwaysConfirmIntents: string[];
}

export const DEFAULT_AUTO_APPROVE_CONFIG: AutoApproveConfig = {
  minSttConfidence: 0.85,
  minEntityConfidence: 0.85,
  maxAutoApproveQuantity: 100,
  alwaysConfirmIntents: ['undo_last'],
};

// ─── Event types for audit log ──────────────────────────────────────────────

export enum EventType {
  PARSED = 'parsed',
  VALIDATED = 'validated',
  CONFIRMED = 'confirmed',
  EXECUTED = 'executed',
  REJECTED = 'rejected',
  REVERTED = 'reverted',
  AUTO_APPROVED = 'auto_approved',
}

// ─── Input DTOs ─────────────────────────────────────────────────────────────

export interface TextCommandInput {
  sessionId: string;
  text: string;
}

export interface VoiceCommandInput {
  sessionId: string;
  audioBuffer: Buffer;
}

// ─── Action types ───────────────────────────────────────────────────────────

export enum ActionType {
  CREATE_GOODS_RECEIPT = 'create_goods_receipt',
  ADJUST_INVENTORY = 'adjust_inventory',
  LOG_DAMAGE = 'log_damage',
  MOVE_STOCK = 'move_stock',
  PICK_STOCK = 'pick_stock',
  CYCLE_COUNT = 'cycle_count',
  REVERT = 'revert',
}
