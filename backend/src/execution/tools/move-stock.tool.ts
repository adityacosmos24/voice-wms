// ─── Move Stock Tool ────────────────────────────────────────────────────────
// Forward: decrement source, increment destination.
// Inverse: reverse the move.

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from '../../database/schemas/inventory.schema';

export interface MoveStockPayload {
  warehouseId: string;
  skuId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
}

export interface MoveStockResult {
  sourceInventoryId: string;
  destinationInventoryId: string;
  sourcePreviousQuantity: number;
  sourceNewQuantity: number;
  destinationPreviousQuantity: number;
  destinationNewQuantity: number;
}

@Injectable()
export class MoveStockTool {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
  ) {}

  async execute(payload: MoveStockPayload): Promise<{
    result: MoveStockResult;
    inversePayload: MoveStockPayload;
  }> {
    // Get source inventory
    const source = await this.inventoryModel.findOne({
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.sourceLocationId,
    }).exec();

    if (!source) {
      throw new BadRequestException('Source inventory not found');
    }

    // Get or create destination inventory
    const destExisting = await this.inventoryModel.findOne({
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.destinationLocationId,
    }).exec();

    const sourcePrevious = source.quantityGood;
    const destPrevious = destExisting?.quantityGood ?? 0;

    // Execute transfer sequentially (no replica-set required transactions for POC)
    const updatedSource = await this.inventoryModel.findByIdAndUpdate(
      source._id,
      { $inc: { quantityGood: -payload.quantity } },
      { new: true }
    ).exec();

    const updatedDest = await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: payload.warehouseId,
        skuId: payload.skuId,
        locationId: payload.destinationLocationId,
      },
      {
        $inc: { quantityGood: payload.quantity },
      },
      { new: true, upsert: true }
    ).exec();

    // Inverse: swap source and destination
    const inversePayload: MoveStockPayload = {
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      sourceLocationId: payload.destinationLocationId,
      destinationLocationId: payload.sourceLocationId,
      quantity: payload.quantity,
    };

    return {
      result: {
        sourceInventoryId: updatedSource!._id.toString(),
        destinationInventoryId: updatedDest!._id.toString(),
        sourcePreviousQuantity: sourcePrevious,
        sourceNewQuantity: updatedSource!.quantityGood,
        destinationPreviousQuantity: destPrevious,
        destinationNewQuantity: updatedDest!.quantityGood,
      },
      inversePayload,
    };
  }

  async revert(inversePayload: MoveStockPayload): Promise<void> {
    // Reverse: move stock back from destination → source
    await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: inversePayload.warehouseId,
        skuId: inversePayload.skuId,
        locationId: inversePayload.sourceLocationId,
      },
      { $inc: { quantityGood: -inversePayload.quantity } }
    ).exec();

    await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: inversePayload.warehouseId,
        skuId: inversePayload.skuId,
        locationId: inversePayload.destinationLocationId,
      },
      { $inc: { quantityGood: inversePayload.quantity } }
    ).exec();
  }
}
