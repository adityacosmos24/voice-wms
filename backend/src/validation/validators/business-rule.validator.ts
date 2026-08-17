// ─── Business Rule Validator ────────────────────────────────────────────────
// Sub-layer 3: Domain-specific constraints that prevent invalid warehouse state.
// Stock can't go negative. Quantities must make sense. Picks can't exceed available.

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from '../../database/schemas/inventory.schema';
import { IntentType, type ParsedIntent } from '../../common/types/intent.types';
import type {
  SubValidationResult,
  ResolvedEntities,
} from '../../common/types/validation.types';

@Injectable()
export class BusinessRuleValidator {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
  ) {}

  async validate(
    parsedIntent: ParsedIntent,
    warehouseId: string,
    resolvedEntities: ResolvedEntities,
  ): Promise<SubValidationResult> {
    const errors: string[] = [];
    const entities = parsedIntent.entities as Record<string, unknown>;

    switch (parsedIntent.intent) {
      case IntentType.GOODS_RECEIPT:
        await this.validateGoodsReceipt(entities, errors);
        break;

      case IntentType.PICK:
        await this.validatePick(entities, warehouseId, resolvedEntities, errors);
        break;

      case IntentType.PUTAWAY:
        await this.validatePutaway(entities, errors);
        break;

      case IntentType.CYCLE_COUNT:
        await this.validateCycleCount(entities, errors);
        break;

      case IntentType.DAMAGE_REPORT:
        await this.validateDamageReport(
          entities, warehouseId, resolvedEntities, errors,
        );
        break;

      case IntentType.TRANSFER:
        await this.validateTransfer(
          entities, warehouseId, resolvedEntities, errors,
        );
        break;

      case IntentType.UNDO_LAST:
        // No business rule validation needed for undo
        break;
    }

    return {
      validator: 'business_rule',
      passed: errors.length === 0,
      errors,
    };
  }

  // ─── Per-intent business rule checks ──────────────────────────────────────

  private async validateGoodsReceipt(
    entities: Record<string, unknown>,
    errors: string[],
  ) {
    const qtyGood = Number(entities.quantity_good ?? 0);
    const qtyDamaged = Number(entities.quantity_damaged ?? 0);

    if (qtyGood + qtyDamaged <= 0) {
      errors.push('Total received quantity (good + damaged) must be greater than 0.');
    }

    if (qtyGood < 0) errors.push('Good quantity cannot be negative.');
    if (qtyDamaged < 0) errors.push('Damaged quantity cannot be negative.');
  }

  private async validatePick(
    entities: Record<string, unknown>,
    warehouseId: string,
    resolved: ResolvedEntities,
    errors: string[],
  ) {
    const qty = Number(entities.quantity ?? 0);
    if (qty <= 0) {
      errors.push('Pick quantity must be greater than 0.');
      return;
    }

    // Check available stock
    if (resolved.skuId && resolved.locationId) {
      const inventory = await this.inventoryModel.findOne({
        warehouseId,
        skuId: resolved.skuId,
        locationId: resolved.locationId,
      }).exec();

      if (!inventory) {
        errors.push(
          `No inventory record for SKU '${resolved.skuCode}' at location '${resolved.locationCode}'.`,
        );
      } else if (inventory.quantityGood < qty) {
        errors.push(
          `Pick quantity (${qty}) exceeds available stock (${inventory.quantityGood}) ` +
          `for SKU '${resolved.skuCode}' at '${resolved.locationCode}'.`,
        );
      }
    }
  }

  private async validatePutaway(
    entities: Record<string, unknown>,
    errors: string[],
  ) {
    const qty = Number(entities.quantity ?? 0);
    if (qty <= 0) {
      errors.push('Putaway quantity must be greater than 0.');
    }
  }

  private async validateCycleCount(
    entities: Record<string, unknown>,
    errors: string[],
  ) {
    const qtyGood = Number(entities.quantity_good ?? 0);
    const qtyDamaged = Number(entities.quantity_damaged ?? 0);

    if (qtyGood < 0) errors.push('Counted good quantity cannot be negative.');
    if (qtyDamaged < 0) errors.push('Counted damaged quantity cannot be negative.');
  }

  private async validateDamageReport(
    entities: Record<string, unknown>,
    warehouseId: string,
    resolved: ResolvedEntities,
    errors: string[],
  ) {
    const qty = Number(entities.quantity ?? 0);
    if (qty <= 0) {
      errors.push('Damage quantity must be greater than 0.');
      return;
    }

    // Can't report more damage than available good stock
    if (resolved.skuId && resolved.locationId) {
      const inventory = await this.inventoryModel.findOne({
        warehouseId,
        skuId: resolved.skuId,
        locationId: resolved.locationId,
      }).exec();

      if (inventory && inventory.quantityGood < qty) {
        errors.push(
          `Damage quantity (${qty}) exceeds available good stock (${inventory.quantityGood}).`,
        );
      }
    }
  }

  private async validateTransfer(
    entities: Record<string, unknown>,
    warehouseId: string,
    resolved: ResolvedEntities,
    errors: string[],
  ) {
    const qty = Number(entities.quantity ?? 0);
    if (qty <= 0) {
      errors.push('Transfer quantity must be greater than 0.');
      return;
    }

    // Source and destination must be different
    if (resolved.sourceLocationId && resolved.destinationLocationId) {
      if (resolved.sourceLocationId === resolved.destinationLocationId) {
        errors.push('Source and destination locations must be different.');
        return;
      }
    }

    // Check available stock at source
    if (resolved.skuId && resolved.sourceLocationId) {
      const inventory = await this.inventoryModel.findOne({
        warehouseId,
        skuId: resolved.skuId,
        locationId: resolved.sourceLocationId,
      }).exec();

      if (!inventory) {
        errors.push(
          `No inventory at source location '${resolved.sourceLocationCode}'.`,
        );
      } else if (inventory.quantityGood < qty) {
        errors.push(
          `Transfer quantity (${qty}) exceeds available stock (${inventory.quantityGood}) ` +
          `at source '${resolved.sourceLocationCode}'.`,
        );
      }
    }
  }
}
