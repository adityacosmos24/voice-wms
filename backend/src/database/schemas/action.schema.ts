import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Command } from './command.schema';

export type ActionDocument = Action & Document;

@Schema({ timestamps: true, collection: 'actions' })
export class Action {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Command', required: true })
  commandId: Command | string;

  @Prop({ required: true })
  actionType: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  inversePayload?: any;

  @Prop()
  executedAt?: Date;

  @Prop()
  revertedAt?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Action' })
  revertedByActionId?: Action | string;
}

export const ActionSchema = SchemaFactory.createForClass(Action);
