import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WarehouseDocument = Warehouse & Document;

@Schema({ timestamps: true, collection: 'warehouses' })
export class Warehouse {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  timezone: string;
}

export const WarehouseSchema = SchemaFactory.createForClass(Warehouse);
