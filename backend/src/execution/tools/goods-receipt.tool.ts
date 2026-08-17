// ─── Goods Receipt Tool ─────────────────────────────────────────────────────
// Forward: create/increment inventory at the target location.
// Inverse: decrement by the same amounts.

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from '../../database/schemas/inventory.schema';

export interface GoodsReceiptPayload {
  warehouseId: string;
  skuId: string;
  locationId: string;
  quantityGood: number;
  quantityDamaged: number;
}

export interface GoodsReceiptResult {
  inventoryId: string;
  previousQuantityGood: number;
  previousQuantityDamaged: number;
  newQuantityGood: number;
  newQuantityDamaged: number;
}

@Injectable()
export class GoodsReceiptTool {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
  ) {}

  /**
   * Execute a goods receipt — create or increment inventory.
   * Returns the forward result and the computed inverse payload.
   */
  async execute(payload: GoodsReceiptPayload): Promise<{
    result: GoodsReceiptResult;
    inversePayload: GoodsReceiptPayload;
  }> {
    // Upsert inventory
    const existing = await this.inventoryModel.findOne({
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.locationId,
    }).exec();

    const previousGood = existing?.quantityGood ?? 0;
    const previousDamaged = existing?.quantityDamaged ?? 0;

    const inventory = await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: payload.warehouseId,
        skuId: payload.skuId,
        locationId: payload.locationId,
      },
      {
        $inc: { 
          quantityGood: payload.quantityGood,
          quantityDamaged: payload.quantityDamaged,
        }
      },
      { new: true, upsert: true }
    ).exec();

    // Compute inverse: decrement by the same amounts
    const inversePayload: GoodsReceiptPayload = {
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.locationId,
      quantityGood: -payload.quantityGood,
      quantityDamaged: -payload.quantityDamaged,
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

  /**
   * Execute the inverse (revert) of a goods receipt.
   */
  async revert(inversePayload: GoodsReceiptPayload): Promise<void> {
    await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: inversePayload.warehouseId,
        skuId: inversePayload.skuId,
        locationId: inversePayload.locationId,
      },
      {
        $inc: { 
          quantityGood: inversePayload.quantityGood,
          quantityDamaged: inversePayload.quantityDamaged,
        }
      },
      { upsert: true }
    ).exec();
  }
}
