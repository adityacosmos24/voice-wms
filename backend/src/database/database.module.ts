import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = (ret._id as any).toString();
      delete ret._id;
    }
  });
  schema.set('toObject', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = (ret._id as any).toString();
      delete ret._id;
    }
  });
});
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import { User, UserSchema } from './schemas/user.schema';
import { Location, LocationSchema } from './schemas/location.schema';
import { Sku, SkuSchema } from './schemas/sku.schema';
import { Inventory, InventorySchema } from './schemas/inventory.schema';
import { Session, SessionSchema } from './schemas/session.schema';
import { Command, CommandSchema } from './schemas/command.schema';
import { Action, ActionSchema } from './schemas/action.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';

const mongooseModule = MongooseModule.forFeature([
  { name: Warehouse.name, schema: WarehouseSchema },
  { name: User.name, schema: UserSchema },
  { name: Location.name, schema: LocationSchema },
  { name: Sku.name, schema: SkuSchema },
  { name: Inventory.name, schema: InventorySchema },
  { name: Session.name, schema: SessionSchema },
  { name: Command.name, schema: CommandSchema },
  { name: Action.name, schema: ActionSchema },
  { name: AuditLog.name, schema: AuditLogSchema },
]);

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/voice-wms'),
    mongooseModule,
  ],
  exports: [mongooseModule],
})
export class DatabaseModule {}
