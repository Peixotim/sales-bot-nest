import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { JwtPayload } from 'src/interfaces/JwtPayload';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WhatsAppGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WhatsAppGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  public async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      const authToken = client.handshake.auth.token as string | undefined;

      const token = authToken || authHeader;

      if (!token) {
        this.logger.warn(`Tentativa de conexão sem token: ${client.id}`);
        client.disconnect();
        return;
      }
      const cleanToken = token.replace('Bearer ', '');

      const payload = this.jwtService.verify<JwtPayload>(cleanToken, {
        secret: process.env.JWT_SECRET,
      });

      const sessionId = payload.sub;

      await client.join(sessionId);

      this.logger.log(`🔌 Cliente conectado na sala: ${sessionId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Falha na autenticação do Socket: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  emitToUser(sessionId: string, event: string, data: any) {
    this.server.to(sessionId).emit(event, data);
  }
}
