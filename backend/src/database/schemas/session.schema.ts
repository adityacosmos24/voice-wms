import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from './user.schema';
import { Warehouse } from './warehouse.schema';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true, collection: 'sessions' })
export class Session {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User | string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Warehouse', required: true })
  warehouseId: Warehouse | string;

  @Prop()
  deviceId?: string;

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop()
  endedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
