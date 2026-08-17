// ─── Entity Validator ───────────────────────────────────────────────────────
// Sub-layer 2: Do the SKUs and locations actually exist in this warehouse?
// Fuzzy matching with Levenshtein distance for typo tolerance.

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sku, SkuDocument } from '../../database/schemas/sku.schema';
import { Location, LocationDocument } from '../../database/schemas/location.schema';
import type { ParsedIntent } from '../../common/types/intent.types';
import type {
  SubValidationResult,
  ResolvedEntities,
} from '../../common/types/validation.types';

@Injectable()
export class EntityValidator {
  constructor(
    @InjectModel(Sku.name) private skuModel: Model<SkuDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
  ) {}

  /**
   * Resolve entity codes (SKU, location) against the warehouse catalog.
   * Uses fuzzy matching to tolerate STT transcription errors.
   */
  async validate(
    parsedIntent: ParsedIntent,
    warehouseId: string,
  ): Promise<SubValidationResult & { resolvedEntities?: ResolvedEntities }> {
    const errors: string[] = [];
    const resolved: ResolvedEntities = {};
    const entities = parsedIntent.entities as Record<string, unknown>;

    // ── Resolve SKU ───────────────────────────────────────────────
    if (entities.sku) {
      const skuResult = await this.resolveSku(
        String(entities.sku),
        warehouseId,
      );
      if (!skuResult) {
        errors.push(
          `SKU '${entities.sku}' not found in warehouse catalog.`,
        );
      } else {
        resolved.skuId = skuResult.id;
        resolved.skuCode = skuResult.code;
        resolved.skuMatchConfidence = skuResult.confidence;
      }
    }

    // ── Resolve location ──────────────────────────────────────────
    if (entities.location) {
      const locResult = await this.resolveLocation(
        String(entities.location),
        warehouseId,
      );
      if (!locResult) {
        errors.push(
          `Location '${entities.location}' not found in warehouse.`,
        );
      } else {
        resolved.locationId = locResult.id;
        resolved.locationCode = locResult.code;
        resolved.locationMatchConfidence = locResult.confidence;
      }
    }

    // ── Resolve source location ───────────────────────────────────
    if (entities.source_location) {
      const srcResult = await this.resolveLocation(
        String(entities.source_location),
        warehouseId,
      );
      if (!srcResult) {
        errors.push(
          `Source location '${entities.source_location}' not found.`,
        );
      } else {
        resolved.sourceLocationId = srcResult.id;
        resolved.sourceLocationCode = srcResult.code;
        resolved.sourceLocationMatchConfidence = srcResult.confidence;
      }
    }

    // ── Resolve destination location ──────────────────────────────
    if (entities.destination_location) {
      const dstResult = await this.resolveLocation(
        String(entities.destination_location),
        warehouseId,
      );
      if (!dstResult) {
        errors.push(
          `Destination location '${entities.destination_location}' not found.`,
        );
      } else {
        resolved.destinationLocationId = dstResult.id;
        resolved.destinationLocationCode = dstResult.code;
        resolved.destinationLocationMatchConfidence = dstResult.confidence;
      }
    }

    return {
      validator: 'entity',
      passed: errors.length === 0,
      errors,
      resolvedEntities: resolved,
      detail: { resolved },
    };
  }

  // ─── Fuzzy resolution helpers ───────────────────────────────────────────

  private async resolveSku(
    code: string,
    warehouseId: string,
  ): Promise<{ id: string; code: string; confidence: number } | null> {
    const skus = await this.skuModel.find({ warehouseId }).select('_id code description').exec();

    // Exact match first
    const exact = skus.find(
      (s: { code: string }) => s.code.toLowerCase() === code.toLowerCase(),
    );
    if (exact) return { id: exact._id.toString(), code: exact.code, confidence: 1.0 };

    // Fuzzy match — Levenshtein distance
    let bestMatch: (typeof skus)[0] | null = null;
    let bestDistance = Infinity;

    for (const sku of skus) {
      const distance = this.levenshtein(
        code.toLowerCase(),
        sku.code.toLowerCase(),
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = sku;
      }
    }

    // Accept fuzzy match only if distance is ≤ 2 characters
    if (bestMatch && bestDistance <= 2) {
      const confidence = 1 - bestDistance / Math.max(code.length, bestMatch.code.length);
      return { id: bestMatch._id.toString(), code: bestMatch.code, confidence };
    }

    return null;
  }

  private async resolveLocation(
    code: string,
    warehouseId: string,
  ): Promise<{ id: string; code: string; confidence: number } | null> {
    const locations = await this.locationModel.find({ warehouseId }).select('_id code zone').exec();

    // Exact match first
    const exact = locations.find(
      (l: { code: string }) => l.code.toLowerCase() === code.toLowerCase(),
    );
    if (exact) return { id: exact._id.toString(), code: exact.code, confidence: 1.0 };

    // Fuzzy match
    let bestMatch: (typeof locations)[0] | null = null;
    let bestDistance = Infinity;

    for (const loc of locations) {
      const distance = this.levenshtein(
        code.toLowerCase(),
        loc.code.toLowerCase(),
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = loc;
      }
    }

    if (bestMatch && bestDistance <= 2) {
      const confidence =
        1 - bestDistance / Math.max(code.length, bestMatch.code.length);
      return { id: bestMatch._id.toString(), code: bestMatch.code, confidence };
    }

    return null;
  }

  /**
   * Levenshtein distance for fuzzy matching.
   */
  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0),
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }

    return dp[m][n];
  }
}
