// ─── Session Service ────────────────────────────────────────────────────────
// User session management — tracks who's operating, from which warehouse, on which device.

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../database/schemas/session.schema';
import { User, UserDocument } from '../database/schemas/user.schema';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Start a new session for a user in a warehouse.
   */
  async startSession(userId: string, warehouseId: string, deviceId?: string) {
    // Verify user belongs to this warehouse
    const user = await this.userModel.findById(userId).exec();
    
    if (!user) {
        throw new NotFoundException(`User '${userId}' not found.`);
    }

    if (user.warehouseId.toString() !== warehouseId) {
      throw new BadRequestException(
        `User '${user.name}' does not belong to warehouse '${warehouseId}'.`,
      );
    }

    // End any active sessions for this user
    await this.sessionModel.updateMany(
      { userId, endedAt: { $exists: false } }, // null is not as reliable in mongo for unassigned
      { $set: { endedAt: new Date() } }
    ).exec();
    await this.sessionModel.updateMany(
      { userId, endedAt: null },
      { $set: { endedAt: new Date() } }
    ).exec();

    // Create new session
    const session = new this.sessionModel({
      userId,
      warehouseId,
      deviceId,
    });
    
    await session.save();

    return this.sessionModel.findById(session._id)
      .populate('user', 'name role')
      .populate('warehouse', 'name')
      .exec();
  }

  /**
   * End an active session.
   */
  async endSession(sessionId: string) {
    return this.sessionModel.findByIdAndUpdate(
      sessionId,
      { $set: { endedAt: new Date() } },
      { new: true }
    ).exec();
  }

  /**
   * Get the current active session for a user.
   */
  async getActiveSession(userId: string) {
    return this.sessionModel.findOne({ userId, endedAt: { $exists: false } }) // Try checking for non-existent field
      .populate('user', 'name role')
      .populate('warehouse', 'name')
      .exec()
      .then(async (doc) => {
        if (!doc) {
           return this.sessionModel.findOne({ userId, endedAt: null }) // Fallback to checking for null field
             .populate('user', 'name role')
             .populate('warehouse', 'name')
             .exec();
        }
        return doc;
      });
  }

  /**
   * Get a session by ID with full details.
   */
  async getSession(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId)
      .populate('user', 'name role')
      .populate('warehouse', 'name')
      .exec();
      
    if (!session) {
        throw new NotFoundException(`Session '${sessionId}' not found.`);
    }
    return session;
  }
}
