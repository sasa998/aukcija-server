/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from 'src/auth/strategies/jwt.strategy';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class AuctionGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AuctionGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token = this.extractTokenFromCookie(client);
    if (!token) return;

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      client.data.userId = payload.sub;
      void client.join(`user:${payload.sub}`);
    } catch {
      this.logger.debug(
        'Invalid/expired token on connect, treating as anonymous',
      );
    }
  }

  @SubscribeMessage('joinAuctions')
  handleJoinAuctions(
    @ConnectedSocket() client: Socket,
    @MessageBody() auctionIds: string[],
  ) {
    auctionIds.forEach((id) => void client.join(`auction:${id}`));
  }

  @SubscribeMessage('leaveAuctions')
  handleLeaveAuctions(
    @ConnectedSocket() client: Socket,
    @MessageBody() auctionIds: string[],
  ) {
    auctionIds.forEach((id) => void client.leave(`auction:${id}`));
  }

  emitBidPlaced(
    auctionId: string,
    payload: {
      currentPrice: number;
      currentBidderId: string;
      bidCount: number;
      endsAt: Date;
    },
  ) {
    this.server.to(`auction:${auctionId}`).emit('auction:bidPlaced', {
      auctionId,
      ...payload,
    });
  }

  emitExtended(auctionId: string, endsAt: string) {
    this.server
      .to(`auction:${auctionId}`)
      .emit('auction:extended', { auctionId, endsAt });
  }

  emitOutbid(userId: string, payload: { auctionId: string; newPrice: number }) {
    this.server.to(`user:${userId}`).emit('auction:outbid', payload);
  }

  private extractTokenFromCookie(client: Socket): string | null {
    const cookieHeader = client.handshake.headers.cookie as string | undefined;
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/access_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
