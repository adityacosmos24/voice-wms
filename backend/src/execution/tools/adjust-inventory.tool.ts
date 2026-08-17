// ─── Adjust Inventory Tool ──────────────────────────────────────────────────
// Forward: set quantity to a new value (used by cycle count / putaway).
// Inverse: set quantity back to the old value.

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from '../../database/schemas/inventory.schema';

export interface AdjustInventoryPayload {
  warehouseId: string;
  skuId: string;
  locationId: string;
  newQuantityGood: number;
  newQuantityDamaged: number;
  /** Stored for inverse — the values before the adjustment */
  previousQuantityGood?: number;
  previousQuantityDamaged?: number;
}

export interface AdjustInventoryResult {
  inventoryId: string;
  previousQuantityGood: number;
  previousQuantityDamaged: number;
  newQuantityGood: number;
  newQuantityDamaged: number;
}

@Injectable()
export class AdjustInventoryTool {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
  ) {}

  async execute(payload: AdjustInventoryPayload): Promise<{
    result: AdjustInventoryResult;
    inversePayload: AdjustInventoryPayload;
  }> {
    // Get current state
    const existing = await this.inventoryModel.findOne({
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.locationId,
    }).exec();

    const previousGood = existing?.quantityGood ?? 0;
    const previousDamaged = existing?.quantityDamaged ?? 0;

    // Upsert with new values
    const inventory = await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: payload.warehouseId,
        skuId: payload.skuId,
        locationId: payload.locationId,
      },
      {
        $set: {
          quantityGood: payload.newQuantityGood,
          quantityDamaged: payload.newQuantityDamaged,
        }
      },
      { new: true, upsert: true }
    ).exec();

    // Inverse: set back to previous values
    const inversePayload: AdjustInventoryPayload = {
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.locationId,
      newQuantityGood: previousGood,
      newQuantityDamaged: previousDamaged,
      previousQuantityGood: payload.newQuantityGood,
      previousQuantityDamaged: payload.newQuantityDamaged,
    };

    return {
      result: {
        inventoryId: inventory._id.toString(),
        previousQuantityGood: previousGood,
        previousQuantityDamaged: previousDamaged,
        newQuantityGood: inventory.quantityGood,
        newQuantityDamaged: inventory.quantityDamaged,
      },
      inversePayload,
    };
  }

  async revert(inversePayload: AdjustInventoryPayload): Promise<void> {
    await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: inversePayload.warehouseId,
        skuId: inversePayload.skuId,
        locationId: inversePayload.locationId,
      },
      {
        $set: {
          quantityGood: inversePayload.newQuantityGood,
          quantityDamaged: inversePayload.newQuantityDamaged,
        }
      },
      { upsert: true }
    ).exec();
  }
}
