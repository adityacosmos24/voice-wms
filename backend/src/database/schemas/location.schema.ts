import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Warehouse } from './warehouse.schema';

export type LocationDocument = Location & Document;

@Schema({ timestamps: true, collection: 'locations' })
export class Location {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Warehouse', required: true })
  warehouseId: Warehouse | string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  zone: string;
}

export const LocationSchema = SchemaFactory.createForClass(Location);
LocationSchema.index({ warehouseId: 1, code: 1 }, { unique: true });
