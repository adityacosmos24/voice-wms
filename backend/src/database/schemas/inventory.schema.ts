import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Warehouse } from './warehouse.schema';
import { Sku } from './sku.schema';
import { Location } from './location.schema';

export type InventoryDocument = Inventory & Document;

@Schema({ timestamps: true, collection: 'inventory' })
export class Inventory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Warehouse', required: true })
  warehouseId: Warehouse | string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Sku', required: true })
  skuId: Sku | string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Location', required: true })
  locationId: Location | string;

  @Prop({ required: true, default: 0 })
  quantityGood: number;

  @Prop({ required: true, default: 0 })
  quantityDamaged: number;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
InventorySchema.index({ warehouseId: 1, skuId: 1, locationId: 1 }, { unique: true });
