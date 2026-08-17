// ─── Pick Tool ──────────────────────────────────────────────────────────────
// Forward: decrement inventory by pick quantity.
// Inverse: increment by the same amount.

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from '../../database/schemas/inventory.schema';

export interface PickPayload {
  warehouseId: string;
  skuId: string;
  locationId: string;
  quantity: number;
}

export interface PickResult {
  inventoryId: string;
  previousQuantity: number;
  newQuantity: number;
}

@Injectable()
export class PickTool {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
  ) {}

  async execute(payload: PickPayload): Promise<{
    result: PickResult;
    inversePayload: PickPayload;
  }> {
    const inventory = await this.inventoryModel.findOne({
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.locationId,
    }).exec();
    
    if (!inventory) {
        throw new BadRequestException('Inventory record not found.');
    }

    const previousQuantity = inventory.quantityGood;

    const updated = await this.inventoryModel.findByIdAndUpdate(
      inventory._id,
      { $inc: { quantityGood: -payload.quantity } },
      { new: true }
    ).exec();

    // Inverse: put the stock back
    const inversePayload: PickPayload = {
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.locationId,
      quantity: -payload.quantity, // negative = increment
    };

    return {
      result: {
        inventoryId: updated!._id.toString(),
        previousQuantity,
        newQuantity: updated!.quantityGood,
      },
      inversePayload,
    };
  }

  async revert(inversePayload: PickPayload): Promise<void> {
    // inversePayload.quantity is negative, so incrementing by it restores stock
    // Since MongoDB $inc takes the negative value and adds it, we need to subtract the negative value
    await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: inversePayload.warehouseId,
        skuId: inversePayload.skuId,
        locationId: inversePayload.locationId,
      },
      {
        $inc: { quantityGood: -inversePayload.quantity }, // double-negative = increment
      }
    ).exec();
  }
}
