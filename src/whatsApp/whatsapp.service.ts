import { Injectable, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage,
  BaileysEventMap,
  WASocket,
} from '@whiskeysockets/baileys';
//import * as qrcode from 'qrcode-terminal';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BoomError } from './interfaces/baileys.interface';
import { WhatsAppAuthService } from './providers/whatsapp-auth.service';
import { WhatsappStatus } from './enums/whatsapp-status.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AiService } from '../ai/ai.service';
import { ContactService } from '../contacts/contacts.service';
import { WhatsAppGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private sessions: Map<string, WASocket> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private statuses: Map<string, WhatsappStatus> = new Map();

  constructor(
    @InjectPinoLogger(WhatsAppService.name)
    private readonly logger: PinoLogger,
    private readonly contactsService: ContactService,
    private readonly whatsAppAuthService: WhatsAppAuthService,
    private readonly aiService: AiService,
    private readonly whatsAppGateway: WhatsAppGateway,
  ) {}

  public async onModuleInit() {}

  public async connectToWhatsapp(sessionId: string) {
    this.updateStatus(sessionId, WhatsappStatus.CONNECTING);

    this.logger.info(`🔄 Iniciando bot para: ${sessionId}`);

    const { state, saveCreds } =
      await this.whatsAppAuthService.getAuthState(sessionId);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      logger: this.logger.logger.child({
        module: 'baileys',
        sessionId,
        levels: 'fatal',
      }) as any,
      browser: ['Peixotim', 'Chrome', '10.0'],
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      retryRequestDelayMs: 5000,
    });

    this.sessions.set(sessionId, socket);

    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.updateStatus(sessionId, WhatsappStatus.QR_CODE);
        this.qrCodes.set(sessionId, qr);
        this.logger.info(`📷 QR Code gerado para ${sessionId}`);
        this.whatsAppGateway.emitToUser(sessionId, 'qr-code', { qrCode: qr });
        this.whatsAppGateway.emitToUser(sessionId, 'status', {
          status: 'QR_CODE_READY',
        });
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error as BoomError | undefined;
        const codeError = error?.output?.statusCode;

        this.updateStatus(sessionId, WhatsappStatus.DISCONNECTED);
        this.whatsAppGateway.emitToUser(sessionId, 'status', {
          status: 'DISCONNECTED',
        });
        const itWasAManualLogout = codeError === DisconnectReason.loggedOut;

        void (async () => {
          if (itWasAManualLogout) {
            this.logger.warn(`❌ Logout manual de ${sessionId}. Limpando...`);
            this.sessions.delete(sessionId);
            await this.whatsAppAuthService.clearSession(sessionId);
          } else {
            this.logger.error(
              `❌ Queda de conexão ${sessionId}. Reconectando...`,
            );
            setTimeout(() => void this.connectToWhatsapp(sessionId), 3000);
          }
        })();
      } else if (connection === 'open') {
        this.logger.info(`✅ Bot ${sessionId} conectado!`);
        this.updateStatus(sessionId, WhatsappStatus.CONNECTED);
        this.qrCodes.delete(sessionId);
        this.whatsAppGateway.emitToUser(sessionId, 'status', {
          status: 'CONNECTED',
        });
      }
    });

    socket.ev.on('creds.update', () => void saveCreds());

    socket.ev.on('messages.upsert', (message) => {
      void this.handleIncomingMessage(sessionId, socket, message);
    });
  }

  public async handleIncomingMessage(
    sessionId: string,
    socket: WASocket,
    messageWrapper: BaileysEventMap['messages.upsert'],
  ) {
    try {
      const msg = messageWrapper.messages[0];
      if (!msg.message || !msg.key || msg.key.fromMe) return;

      const sender = msg.key.remoteJid;
      if (!sender) return;

      const cleanSender = sender.replace(/:\d+@/, '@');

      const isBlocked =
        await this.contactsService.isContactBlocked(cleanSender);

      if (isBlocked) {
        this.logger.warn(`🚫 Mensagem ignorada de ${cleanSender} (Blacklist)`);
        return;
      }

      const messageText =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      const audioMessage = msg.message.audioMessage;

      if (messageText) {
        this.logger.info(
          `[${sessionId}] 📩 Texto de ${sender}: ${messageText}`,
        );

        await this.simulateTyping(socket, sender, 'Digitando...');

        const aiResponse = await this.aiService.processTextMessage(
          sender,
          messageText,
        );

        await this.simulateTyping(socket, sender, aiResponse);
        await socket.sendMessage(sender, { text: aiResponse });
      } else if (audioMessage) {
        this.logger.info(
          `[${sessionId}] 🎤 Áudio de ${sender}. Processando...`,
        );

        const buffer = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            logger: this.logger.logger as any,
            reuploadRequest: socket.updateMediaMessage,
          },
        );

        // 1. Define caminho temporário
        const tempFolder = path.resolve(__dirname, '..', '..', 'temp');
        try {
          await fs.access(tempFolder);
        } catch {
          await fs.mkdir(tempFolder, { recursive: true });
        }

        const fileName = `${sessionId}_${msg.key.id}.ogg`;
        const filePath = path.join(tempFolder, fileName);
        await fs.writeFile(filePath, buffer);
        this.logger.info(`[${sessionId}] 💾 Áudio salvo: ${fileName}`);
        await this.simulateTyping(socket, sender, 'Ouvindo...');

        const aiResponse = await this.aiService.processAudioMessage(
          sender,
          filePath,
        );

        this.logger.info(`[${sessionId}] 🤖 Resposta IA: ${aiResponse}`);

        await this.simulateTyping(socket, sender, aiResponse);

        await socket.sendMessage(sender, { text: aiResponse }, { quoted: msg });

        await fs.unlink(filePath);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error({ err }, `Erro ao processar mensagem de ${sessionId}`);
    }
  }
  private async simulateTyping(socket: WASocket, jid: string, text: string) {
    const delay = Math.min(text.length * 50, 5000);
    await socket.sendPresenceUpdate('composing', jid);
    await new Promise((r) => setTimeout(r, delay));
    await socket.sendPresenceUpdate('paused', jid);
  }

  private updateStatus(sessionId: string, status: WhatsappStatus) {
    this.statuses.set(sessionId, status);
  }

  public getStatus(sessionId: string) {
    const socket = this.sessions.get(sessionId);
    return {
      status: this.statuses.get(sessionId) || WhatsappStatus.DISCONNECTED,
      id: socket?.user?.id || null,
    };
  }

  public getQrCode(sessionId: string) {
    const status = this.statuses.get(sessionId) || WhatsappStatus.DISCONNECTED;
    const qr = this.qrCodes.get(sessionId);

    return {
      status: status,
      qrCode: qr || null,
      message: qr ? 'QR Code pronto' : 'Aguardando geração do QR Code...',
    };
  }

  public async getChatHistory(jid: string) {
    return this.aiService.getChatHistory(jid);
  }

  public getActiveChats() {
    return this.aiService.getActiveChats();
  }
}
