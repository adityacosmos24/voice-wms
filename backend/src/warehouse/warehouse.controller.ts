// ─── Warehouse Controller ───────────────────────────────────────────────────

import { Controller, Get, Param, Query } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';

@Controller('api/warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  async listWarehouses() {
    return this.warehouseService.listWarehouses();
  }

  @Get(':id')
  async getWarehouse(@Param('id') id: string) {
    return this.warehouseService.getWarehouse(id);
  }

  @Get(':id/config')
  async getWarehouseConfig(@Param('id') id: string) {
    return this.warehouseService.getWarehouseConfig(id);
  }

  @Get(':id/inventory')
  async getInventory(
    @Param('id') id: string,
    @Query('locationId') locationId?: string,
    @Query('skuId') skuId?: string,
  ) {
    return this.warehouseService.getInventory(id, { locationId, skuId });
  }
}
