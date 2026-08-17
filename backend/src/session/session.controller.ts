// ─── Session Controller ─────────────────────────────────────────────────────

import { Controller, Post, Get, Param, Body, Delete } from '@nestjs/common';
import { SessionService } from './session.service';

@Controller('api/sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  async startSession(
    @Body() body: { userId: string; warehouseId: string; deviceId?: string },
  ) {
    return this.sessionService.startSession(
      body.userId,
      body.warehouseId,
      body.deviceId,
    );
  }

  @Get('active/:userId')
  async getActiveSession(@Param('userId') userId: string) {
    return this.sessionService.getActiveSession(userId);
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.sessionService.getSession(id);
  }

  @Delete(':id')
  async endSession(@Param('id') id: string) {
    return this.sessionService.endSession(id);
  }
}
