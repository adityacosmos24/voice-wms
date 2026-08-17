import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Command } from './command.schema';
import { Action } from './action.schema';
import { User } from './user.schema';

export type AuditLogDocument = AuditLog & Document;

export enum EventType {
  parsed = 'parsed',
  validated = 'validated',
  confirmed = 'confirmed',
  executed = 'executed',
  rejected = 'rejected',
  reverted = 'reverted',
  auto_approved = 'auto_approved',
}

@Schema({ timestamps: true, collection: 'audit_log' })
export class AuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Command' })
  commandId?: Command | string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Action' })
  actionId?: Action | string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actorUserId: User | string;

  @Prop({ type: String, enum: EventType, required: true })
  eventType: EventType;

  @Prop({ type: MongooseSchema.Types.Mixed })
  detail?: any;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
