import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env vars
dotenv.config({ path: resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/voice_wms';

// Very basic schemas for seeding
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
}, { timestamps: true });

const warehouseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String },
}, { timestamps: true });

const skuSchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  code: { type: String, required: true },
  description: { type: String },
}, { timestamps: true });

const locationSchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  code: { type: String, required: true },
  zone: { type: String },
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  deviceId: { type: String },
  endedAt: { type: Date },
}, { timestamps: true });

const inventorySchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  skuId: { type: mongoose.Schema.Types.ObjectId, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantityGood: { type: Number, default: 0 },
  quantityDamaged: { type: Number, default: 0 },
}, { timestamps: true });

async function seed() {
  console.log(`Connecting to MongoDB at ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);

  const User = mongoose.models.User || mongoose.model('User', userSchema);
  const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
  const Sku = mongoose.models.Sku || mongoose.model('Sku', skuSchema);
  const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);
  const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
  const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

  console.log('Clearing old data...');
  await User.deleteMany({});
  await Warehouse.deleteMany({});
  await Sku.deleteMany({});
  await Location.deleteMany({});
  await Inventory.deleteMany({});
  await Session.deleteMany({});

  console.log('Seeding data...');

  const DEV_USER_ID = '000000000000000000000001';
  const DEV_WH_ID = '000000000000000000000002';
  const DEV_SESSION_ID = '000000000000000000000003';

  // Create Warehouse
  const wh = await Warehouse.create({
    _id: DEV_WH_ID,
    name: 'Main Distribution Center',
    location: 'Chicago, IL',
  });

  // Create Users
  const admin = await User.create({
    _id: DEV_USER_ID,
    username: 'admin',
    name: 'Rajesh Kumar',
    password: 'password123',
    role: 'admin',
    warehouseId: DEV_WH_ID,
  });

  const worker = await User.create({
    username: 'worker1',
    name: 'Worker 1',
    password: 'password123',
    role: 'picker',
    warehouseId: DEV_WH_ID,
  });

  // Create Session
  await Session.create({
    _id: DEV_SESSION_ID,
    userId: DEV_USER_ID,
    warehouseId: DEV_WH_ID,
  });

  // Create Locations
  const locA = await Location.create({ warehouseId: wh._id, code: 'A-01-01', zone: 'A' });
  const locB = await Location.create({ warehouseId: wh._id, code: 'B-02-05', zone: 'B' });
  const locC = await Location.create({ warehouseId: wh._id, code: 'C-RECEIVING', zone: 'C' });

  // Create SKUs
  const sku1 = await Sku.create({ warehouseId: wh._id, code: 'SKU-1001', description: 'Widget A' });
  const sku2 = await Sku.create({ warehouseId: wh._id, code: 'SKU-2002', description: 'Widget B' });

  // Create Inventory
  await Inventory.create({
    warehouseId: wh._id,
    skuId: sku1._id,
    locationId: locA._id,
    quantityGood: 150,
    quantityDamaged: 2,
  });

  await Inventory.create({
    warehouseId: wh._id,
    skuId: sku2._id,
    locationId: locB._id,
    quantityGood: 80,
    quantityDamaged: 0,
  });

  console.log('Seeding completed successfully!');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
