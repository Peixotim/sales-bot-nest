import { Injectable, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage,
  BaileysEventMap,
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BoomError } from './interfaces/baileys.interface';
import { WhatsAppAuthService } from './providers/whatsapp-auth.service';
import { WhatsappStatus } from './enums/whatsapp-status.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AiService } from '../ai/ai.service';
import { ContactService } from 'src/contacts/contacts.service';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private socket: ReturnType<typeof makeWASocket> | undefined;
  private qrCode: string | undefined;
  private status: WhatsappStatus = WhatsappStatus.CONNECTING;

  constructor(
    @InjectPinoLogger(WhatsAppService.name)
    private readonly logger: PinoLogger,
    private readonly contactsService: ContactService,
    private readonly whatsAppAuthService: WhatsAppAuthService,
    private readonly aiService: AiService,
  ) {}

  public async onModuleInit() {
    await this.connectToWhatsapp();
  }

  private async simulateTyping(jid: string, text: string) {
    if (!this.socket) return;

    const delay = Math.min(text.length * 50, 5000); // No maximo 5s de delay

    await this.socket.sendPresenceUpdate('composing', jid);
    await new Promise((r) => setTimeout(r, delay));
    await this.socket.sendPresenceUpdate('paused', jid);
  }

  public async connectToWhatsapp() {
    this.status = WhatsappStatus.CONNECTING;
    this.logger.info(`🔄 Tentando se conectar ao WhatsApp...`);

    const { state, saveCreds } = await this.whatsAppAuthService.getAuthState();
    const { version } = await fetchLatestBaileysVersion();

    this.socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      logger: this.logger.logger.child({
        module: 'baileys',
        levels: 'fatal',
      }) as any,
      browser: ['Peixotims Bot', 'Chrome', '10.0'],
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      retryRequestDelayMs: 5000,
    });

    // CORREÇÃO: Removemos o 'async' daqui para satisfazer o tipo 'void'
    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = WhatsappStatus.QR_CODE;
        this.logger.info('📷 Status: Aguardando leitura do QR Code...');
        this.qrCode = qr;
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error as BoomError | undefined;
        const codeError = error?.output?.statusCode;

        this.status = WhatsappStatus.DISCONNECTED;

        const itWasAManualLogout = codeError === DisconnectReason.loggedOut;

        // AQUI ESTÁ O SEGREDO:
        // Criamos uma função async auto-executável (void) para lidar com o await
        void (async () => {
          if (itWasAManualLogout) {
            this.logger.warn(
              '❌ Conexão encerrada. Usuário fez logout. Limpando sessão...',
            );

            // Agora o await funciona perfeitamente aqui dentro
            await this.whatsAppAuthService.clearSession();

            this.logger.info('🔄 Reiniciando para gerar novo QR Code...');
            setTimeout(() => void this.connectToWhatsapp(), 3000);
          } else {
            this.logger.error(
              { error },
              '❌ Conexão caiu. Tentando reconectar automaticamente...',
            );
            // Reconexão normal por queda de internet
            setTimeout(() => void this.connectToWhatsapp(), 3000);
          }
        })();
      } else if (connection === 'open') {
        this.logger.info(
          '✅ Conexão estabelecida com sucesso! O Bot está online.',
        );
        this.status = WhatsappStatus.CONNECTED;
        this.qrCode = undefined;
      }
    });

    this.socket.ev.on('creds.update', () => void saveCreds());

    this.socket.ev.on('messages.upsert', (message) => {
      void this.handleIncomingMessage(message);
    });
  }

  public async handleIncomingMessage(
    messageWrapper: BaileysEventMap['messages.upsert'],
  ) {
    try {
      const msg = messageWrapper.messages[0];

      if (!msg.message || !msg.key) return;

      if (msg.key.fromMe || messageWrapper.type !== 'notify') return;

      const sender = msg.key.remoteJid;
      if (!sender) return;

      const isBlocked = await this.contactsService.isContactBlocked(sender);
      if (isBlocked) {
        this.logger.warn(`🚫 Mensagem ignorada de ${sender} (Blacklist)`);
        return;
      }

      const messageText =
        msg.message.conversation || msg.message.extendedTextMessage?.text;

      const audioMessage = msg.message.audioMessage;

      if (messageText) {
        this.logger.info(`📩 Texto de ${sender}: ${messageText}`);

        const aiResponse = await this.aiService.processTextMessage(
          sender,
          messageText,
        );

        await this.simulateTyping(sender, aiResponse);

        await this.socket?.sendMessage(sender, {
          text: aiResponse,
        });
      }
      // CENÁRIO 2: ÁUDIO
      else if (audioMessage) {
        this.logger.info(`🎤 Áudio recebido de ${sender}. Baixando...`);

        const buffer = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            logger: this.logger.logger as any,
            reuploadRequest: (msg) =>
              this.socket?.updateMediaMessage
                ? this.socket.updateMediaMessage(msg)
                : Promise.resolve(msg),
          },
        );

        const tempFolder = path.resolve(__dirname, '..', '..', 'temp');
        // Ensure directory exists
        try {
          await fs.access(tempFolder);
        } catch {
          await fs.mkdir(tempFolder, { recursive: true });
        }

        const fileName = `${msg.key.id}.ogg`;
        const filePath = path.join(tempFolder, fileName);

        await fs.writeFile(filePath, buffer);
        this.logger.info(`💾 Áudio salvo em: ${filePath}`);

        const aiResponse = await this.aiService.processAudioMessage(
          sender,
          filePath,
        );

        this.logger.info(`🤖 Resposta da IA (Áudio): ${aiResponse}`);

        await this.simulateTyping(sender, aiResponse);
        await this.socket?.sendMessage(
          sender,
          {
            text: aiResponse,
          },
          { quoted: msg },
        );

        await fs.unlink(filePath);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error({ err }, 'Erro ao processar mensagem');
    }
  }

  public async getActiveChats() {
    return this.aiService.getActiveChats();
  }

  public async getChatHistory(jid: string) {
    return this.aiService.getChatHistory(jid);
  }

  public getStatus() {
    return {
      status: this.status,
      id: this.socket?.user?.id || null,
    };
  }

  public getQrCode() {
    return { qrCode: this.qrCode };
  }
}
