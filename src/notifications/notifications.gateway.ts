import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const fanAddress = client.handshake.query.fanAddress as string;
    
    if (!fanAddress) {
      this.logger.warn(`Client connected without fanAddress, disconnecting`);
      client.disconnect();
      return;
    }

    // Join room based on fan address
    const roomName = `fan:${fanAddress}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined room ${roomName}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Emit new_tier event to fans who follow a creator
   * Only emits to fans who have active passes for that creator
   */
  async emitNewTierEvent(creatorAddress: string, tierData: any) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });

    if (!creator) {
      this.logger.warn(`Creator not found: ${creatorAddress}`);
      return;
    }

    // Find all fans with active passes for this creator
    const activePasses = await this.prisma.pass.findMany({
      where: {
        creatorId: creator.id,
        active: true,
        expiresAt: { gt: new Date() },
      },
      include: {
        fan: true,
      },
    });

    // Emit to each fan's room
    for (const pass of activePasses) {
      const roomName = `fan:${pass.fan.stellarAddress}`;
      this.server.to(roomName).emit('new_tier', {
        creatorAddress,
        tier: tierData,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Emitted new_tier event to room ${roomName}`);
    }
  }

  /**
   * Emit pass_expiring_soon event when a fan's pass expires in < 48 hours
   */
  async emitPassExpiringSoonEvent(fanAddress: string, passData: any) {
    const roomName = `fan:${fanAddress}`;
    this.server.to(roomName).emit('pass_expiring_soon', {
      pass: passData,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Emitted pass_expiring_soon event to room ${roomName}`);
  }

  /**
   * Emit pass_renewal_failed event when a pass auto-renewal fails
   */
  async emitPassRenewalFailedEvent(fanAddress: string, data: any) {
    const roomName = `fan:${fanAddress}`;
    this.server.to(roomName).emit('pass_renewal_failed', {
      data,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Emitted pass_renewal_failed event to room ${roomName}`);
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { fanAddress: string }) {
    const roomName = `fan:${data.fanAddress}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined room ${roomName} via join event`);
    return { event: 'joined', room: roomName };
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { fanAddress: string }) {
    const roomName = `fan:${data.fanAddress}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left room ${roomName}`);
    return { event: 'left', room: roomName };
  }
}
