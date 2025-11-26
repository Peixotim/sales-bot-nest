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
import { AiService } from 'src/ai/ai.service';
@Injectable()
export class WhatsAppService implements OnModuleInit {
  private socket: ReturnType<typeof makeWASocket> | undefined;

  constructor(
    @InjectPinoLogger(WhatsAppService.name)
    private readonly logger: PinoLogger,
    private readonly whatsAppAuthService: WhatsAppAuthService,
    private readonly aiService: AiService,
  ) {}

  private qrCode: string | undefined;

  private status: WhatsappStatus = WhatsappStatus.CONNECTING;

  public async onModuleInit() {
    await this.connectToWhatsapp(); //Espera a funcao terminar para que o service seja iniciado
  }

  public async connectToWhatsapp() {
    this.status = WhatsappStatus.CONNECTING;

    console.log(`🔄 Tentando se conectar ao WhatsApp...`);

    const { state, saveCreds } = await this.whatsAppAuthService.getAuthState();

    const { version } = await fetchLatestBaileysVersion(); //Pega a ultima versão do WhatsAppWeb

    this.socket = makeWASocket({
      version,
      auth: state, //Credenciais carregadas logo acima
      printQRInTerminal: false, //Aqui gera o qrcode no terminal , mas quero gerar-lo manualmente
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      logger: this.logger.logger.child({
        module: 'baileys',
        levels: 'fatal',
      }) as any, //Logger Personalizado
      browser: ['Peixotims Bot', 'Chrome', '10.0'],
      connectTimeoutMs: 60_000, //Demora mais para enviar os dados mais longos
      defaultQueryTimeoutMs: 60_000, //Demora mais para enviar os dados mais longos
      keepAliveIntervalMs: 30_000, // Mantém a conexão viva enviando sinais a cada 30 segundos
      retryRequestDelayMs: 5000, // 4. Retry (Tentar de novo se falhar requisição HTTP)
    });

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = WhatsappStatus.QR_CODE;
        this.logger.info('📷 Status: Aguardando leitura do QR Code...');
        this.qrCode = qr;
        qrcode.generate(qr, { small: true });
      }

      // Se a conexao cair ou for fechada
      if (connection === 'close') {
        const error = lastDisconnect?.error as BoomError | undefined;

        const codeError = error?.output?.statusCode;

        this.status = WhatsappStatus.DISCONNECTED;
        //Verifica se o usuario deu desconect no celular
        const itWasAManualLogout = codeError === DisconnectReason.loggedOut; //Pessoa deslogou no celular
        const mustReconnect = !itWasAManualLogout; //Deve tentar se reconectar caso a pessoa nao deslogou manualmente

        if (itWasAManualLogout) {
          this.logger.warn(
            '❌ Conexão encerrada. Você desconectou pelo celular.',
          );
        } else {
          this.logger.error(
            { error },
            '❌ Conexão caiu. Tentando reconectar automaticamente...',
          );
        }

        if (mustReconnect) {
          setTimeout(() => {
            void this.connectToWhatsapp();
          }, 3000); //Delay de 3s (está em milisegundos)
        }
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
      void this.handleIcomingMessage(message);
    });
  }

  public async handleIcomingMessage(
    messageWrapper: BaileysEventMap['messages.upsert'],
  ) {
    try {
      const msg = messageWrapper.messages[0];

      if (!msg.message) {
        console.log('Mensagem do sistema ou vazia :)');
      } // Mensagem vazia ou de sistema

      // Ignora mensagens do próprio bot ou updates que não sejam notificações
      if (msg.key.fromMe || messageWrapper.type !== 'notify') {
        return 'Mensagem do proprio bot , ou não é notificao';
      }

      if (!msg.message || !msg.key) {
        return;
      }

      const sender = msg.key.remoteJid;

      const messageText =
        msg.message.conversation || msg.message.extendedTextMessage?.text;

      const audioMessage = msg.message.audioMessage;

      if (messageText) {
        this.logger.info(`📩 Texto de ${sender}: ${messageText}`);
        const aiResponse = await this.aiService.processTextMessage(messageText);
        await this.socket?.sendMessage(sender!, {
          text: aiResponse,
        });
      } else if (audioMessage) {
        this.logger.info(`🎤 Áudio recebido de ${sender}. Baixando...`); //Aqui relata que foi enviado um audio pelo usuario do numero (sender)
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
        try {
          await fs.access(tempFolder);
        } catch {
          await fs.mkdir(tempFolder, { recursive: true });
        }

        const fileName = `${msg.key.id}.ogg`;
        const filePath = path.join(tempFolder, fileName);

        await fs.writeFile(filePath, buffer);

        this.logger.info(`💾 Áudio salvo em: ${filePath}`);

        const aiResponse = await this.aiService.processAudioMessage(filePath);
        this.logger.info(`🤖 Resposta da IA (Áudio): ${aiResponse}`);

        await this.socket?.sendMessage(
          sender!,
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
