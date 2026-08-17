// ─── Orchestrator Controller ────────────────────────────────────────────────
// REST endpoints for the command pipeline and audit feed.

import { Controller, Post, Get, Param, Body, Query, HttpCode, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrchestratorService } from './orchestrator.service';
import { AuditService, type AuditFeedFilters } from '../audit/audit.service';
import { RevertService } from '../audit/revert.service';

@Controller('api')
export class OrchestratorController {
  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly auditService: AuditService,
    private readonly revertService: RevertService,
  ) {}

  // ─── Command Pipeline ───────────────────────────────────────────────────

  /**
   * Submit a text command (Phase 1).
   * Body: { sessionId: string, text: string }
   * The `text` field should be a JSON string matching ParsedIntent schema.
   */
  @Post('commands/text')
  async submitTextCommand(
    @Body() body: { sessionId: string; text: string },
  ) {
    return this.orchestratorService.processTextCommand(body);
  }

  /**
   * Submit a voice command (Phase 2).
   */
  @Post('commands/voice')
  @UseInterceptors(FileInterceptor('audio'))
  async submitVoiceCommand(
    @UploadedFile() file: Express.Multer.File,
    @Body('sessionId') sessionId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }

    return this.orchestratorService.processVoiceCommand(
      sessionId,
      file.buffer,
      file.mimetype,
    );
  }

  /**
   * Confirm a pending command.
   */
  @Post('commands/:id/confirm')
  @HttpCode(200)
  async confirmCommand(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.orchestratorService.confirmCommand(id, body.userId);
  }

  /**
   * Reject a pending command.
   */
  @Post('commands/:id/reject')
  @HttpCode(200)
  async rejectCommand(
    @Param('id') id: string,
    @Body() body: { userId: string; reason?: string },
  ) {
    return this.orchestratorService.rejectCommand(id, body.userId, body.reason);
  }

  // ─── Revert ─────────────────────────────────────────────────────────────

  /**
   * Revert an executed action.
   */
  @Post('actions/:id/revert')
  @HttpCode(200)
  async revertAction(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.orchestratorService.revertAction(id, body.userId);
  }

  /**
   * Check if an action can be reverted.
   */
  @Get('actions/:id/can-revert')
  async canRevert(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    return this.orchestratorService.canRevert(id, userId);
  }

  // ─── Audit Feed ─────────────────────────────────────────────────────────

  /**
   * Get the paginated command feed with filters.
   */
  @Get('commands')
  async getCommandFeed(
    @Query('warehouseId') warehouseId?: string,
    @Query('userId') userId?: string,
    @Query('zone') zone?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: AuditFeedFilters = {
      warehouseId,
      userId,
      zone,
      status,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };
    return this.auditService.getFeed(filters);
  }

  /**
   * Get a single command with full detail.
   */
  @Get('commands/:id')
  async getCommandDetail(@Param('id') id: string) {
    return this.auditService.getCommandDetail(id);
  }

  /**
   * Get the audit event timeline for a command.
   */
  @Get('commands/:id/history')
  async getCommandHistory(@Param('id') id: string) {
    return this.auditService.getCommandHistory(id);
  }
}
