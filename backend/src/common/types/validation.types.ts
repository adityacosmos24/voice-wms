// ─── Validation Types ───────────────────────────────────────────────────────
// Each validation sub-layer returns a standardized result. The orchestrator
// aggregates these into a final decision: approve / reject / confirm.

/**
 * Result from a single validation sub-layer.
 */
export interface SubValidationResult {
  /** Name of the validator */
  validator: string;
  /** Whether this check passed */
  passed: boolean;
  /** Human-readable errors or warnings */
  errors: string[];
  /** Additional detail (e.g., fuzzy match scores, resolved IDs) */
  detail?: Record<string, unknown>;
}

/**
 * Aggregated result from all 5 validation sub-layers.
 */
export interface ValidationResult {
  /** Overall pass/fail — all sub-layers must pass for this to be true */
  passed: boolean;
  /** Whether the command should be routed to confirmation despite passing */
  requiresConfirmation: boolean;
  /** Human-readable reason if confirmation is required */
  confirmationReason?: string;
  /** Per-sub-layer results */
  results: SubValidationResult[];
  /** Resolved entity IDs (populated by entity validator) */
  resolvedEntities?: ResolvedEntities;
}

/**
 * Entity IDs resolved from the raw text codes against the warehouse catalog.
 */
export interface ResolvedEntities {
  [key: string]: unknown;
  skuId?: string;
  skuCode?: string;
  skuMatchConfidence?: number;
  locationId?: string;
  locationCode?: string;
  locationMatchConfidence?: number;
  sourceLocationId?: string;
  sourceLocationCode?: string;
  sourceLocationMatchConfidence?: number;
  destinationLocationId?: string;
  destinationLocationCode?: string;
  destinationLocationMatchConfidence?: number;
}

/**
 * The final validation decision, used by the orchestrator.
 */
export enum ValidationDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
  CONFIRM = 'confirm',
}

/**
 * Role-based permission matrix.
 * Maps user roles to the intents they are authorized to perform.
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  picker: ['pick', 'putaway', 'cycle_count', 'damage_report'],
  supervisor: ['pick', 'putaway', 'cycle_count', 'damage_report', 'goods_receipt', 'transfer', 'undo_last'],
  admin: ['pick', 'putaway', 'cycle_count', 'damage_report', 'goods_receipt', 'transfer', 'undo_last'],
};
