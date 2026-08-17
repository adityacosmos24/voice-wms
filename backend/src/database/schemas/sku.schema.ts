import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Warehouse } from './warehouse.schema';

export type SkuDocument = Sku & Document;

@Schema({ timestamps: true, collection: 'skus' })
export class Sku {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Warehouse', required: true })
  warehouseId: Warehouse | string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  uom: string;
}

export const SkuSchema = SchemaFactory.createForClass(Sku);
SkuSchema.index({ warehouseId: 1, code: 1 }, { unique: true });
