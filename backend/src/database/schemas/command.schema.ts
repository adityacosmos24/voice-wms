import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Session } from './session.schema';
import { CommandStatus } from '../../common/types/command.types';

export type CommandDocument = Command & Document;

export { CommandStatus }; // Re-export for compatibility if needed

@Schema({ timestamps: true, collection: 'commands' })
export class Command {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Session', required: true })
  sessionId: Session | string;

  @Prop()
  transcript?: string;

  @Prop()
  sttConfidence?: number;

  @Prop({ type: MongooseSchema.Types.Mixed })
  parsedIntent?: any;

  @Prop()
  entityConfidence?: number;

  @Prop({ type: MongooseSchema.Types.Mixed })
  validationResult?: any;

  @Prop({ type: String, enum: CommandStatus, required: true })
  status: CommandStatus;
}

export const CommandSchema = SchemaFactory.createForClass(Command);
