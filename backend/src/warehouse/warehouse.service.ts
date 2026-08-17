// ─── Warehouse Service ──────────────────────────────────────────────────────
// CRUD for warehouses, locations, SKUs. Loads warehouse config for entity resolution.

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from '../database/schemas/warehouse.schema';
import { Sku, SkuDocument } from '../database/schemas/sku.schema';
import { Location, LocationDocument } from '../database/schemas/location.schema';
import { User, UserDocument } from '../database/schemas/user.schema';
import { Inventory, InventoryDocument } from '../database/schemas/inventory.schema';
import type { SessionContext } from '../common/types/intent.types';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectModel(Warehouse.name) private warehouseModel: Model<WarehouseDocument>,
    @InjectModel(Sku.name) private skuModel: Model<SkuDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
  ) {}

  /**
   * Get a warehouse by ID.
   */
  async getWarehouse(warehouseId: string) {
    const warehouse = await this.warehouseModel.findById(warehouseId).exec();
    if (!warehouse) throw new NotFoundException(`Warehouse '${warehouseId}' not found.`);
    return warehouse;
  }

  /**
   * List all warehouses.
   */
  async listWarehouses() {
    return this.warehouseModel.find().sort({ name: 1 }).exec();
  }

  /**
   * Load the full warehouse configuration object for entity resolution.
   * This is the "onboarding" step — loaded at session start.
   */
  async getWarehouseConfig(warehouseId: string): Promise<{
    skuCatalog: Array<{ code: string; description: string; id: string }>;
    locationCatalog: Array<{ code: string; zone: string; id: string }>;
  }> {
    const [skus, locations] = await Promise.all([
      this.skuModel.find({ warehouseId }).select('_id code description').sort({ code: 1 }).exec(),
      this.locationModel.find({ warehouseId }).select('_id code zone').sort({ code: 1 }).exec(),
    ]);

    return {
      skuCatalog: skus.map(s => ({ id: s._id.toString(), code: s.code, description: s.description })),
      locationCatalog: locations.map(l => ({ id: l._id.toString(), code: l.code, zone: l.zone })),
    };
  }

  /**
   * Build a full SessionContext for use by the LLM and validation layers.
   */
  async buildSessionContext(
    sessionId: string,
    userId: string,
    warehouseId: string,
  ): Promise<SessionContext> {
    const [warehouse, user, config] = await Promise.all([
      this.getWarehouse(warehouseId),
      this.userModel.findById(userId).exec(),
      this.getWarehouseConfig(warehouseId),
    ]);

    if (!user) throw new NotFoundException('User not found');

    return {
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      sessionId,
      skuCatalog: config.skuCatalog,
      locationCatalog: config.locationCatalog,
    };
  }

  /**
   * Get inventory for a warehouse, optionally filtered by location or SKU.
   */
  async getInventory(
    warehouseId: string,
    filters?: { locationId?: string; skuId?: string },
  ) {
    const query: any = { warehouseId };
    if (filters?.locationId) query.locationId = filters.locationId;
    if (filters?.skuId) query.skuId = filters.skuId;

    return this.inventoryModel
      .find(query)
      .populate('sku', 'code description uom')
      .populate('location', 'code zone')
      .sort({ updatedAt: -1 })
      .exec();
  }
}
