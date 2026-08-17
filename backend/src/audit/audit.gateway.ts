// ─── Audit WebSocket Gateway ────────────────────────────────────────────────
// Pushes new audit-log entries to the dashboard in real time.

import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  namespace: 'audit',
  cors: { origin: '*' },
})
export class AuditGateway {
  @WebSocketServer()
  server: Server;

  /**
   * Push a new audit event to all connected dashboard clients.
   */
  emitAuditEvent(eventType: string, data: unknown) {
    this.server.emit('audit:event', { eventType, data, timestamp: new Date() });
  }

  /**
   * Push a command status change to all connected clients.
   */
  emitCommandStatusChange(commandId: string, newStatus: string, data?: unknown) {
    this.server.emit('command:status_change', {
      commandId,
      newStatus,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Push a new command to the feed.
   */
  emitNewCommand(command: unknown) {
    this.server.emit('audit:new_command', {
      command,
      timestamp: new Date(),
    });
  }

  /**
   * Push a revert event.
   */
  emitRevert(actionId: string, data: unknown) {
    this.server.emit('audit:revert', {
      actionId,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Push a confirmation request to a specific user.
   */
  emitConfirmationRequired(commandId: string, data: unknown) {
    this.server.emit('confirmation:required', {
      commandId,
      data,
      timestamp: new Date(),
    });
  }
}
