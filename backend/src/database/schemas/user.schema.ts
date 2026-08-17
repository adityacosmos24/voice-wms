import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Warehouse } from './warehouse.schema';

export type UserDocument = User & Document;

export enum UserRole {
  picker = 'picker',
  supervisor = 'supervisor',
  admin = 'admin',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Warehouse', required: true })
  warehouseId: Warehouse | string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);
