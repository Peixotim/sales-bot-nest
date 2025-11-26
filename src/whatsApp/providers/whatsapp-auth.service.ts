import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
} from '@whiskeysockets/baileys';
import type { SignalDataTypeMap } from '@whiskeysockets/baileys';
import { WhatsAppSession } from '../entity/whatsapp-session.entity';

@Injectable()
export class WhatsAppAuthService {
  constructor(
    @InjectPinoLogger(WhatsAppAuthService.name)
    private readonly logger: PinoLogger,
    @InjectRepository(WhatsAppSession)
    private readonly sessionRepo: Repository<WhatsAppSession>,
  ) {}

  public async getAuthState(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    const creds =
      (await this.readData<AuthenticationCreds>('creds')) || initAuthCreds();

    return {
      state: {
        creds,
        keys: {
          get: async <T extends keyof SignalDataTypeMap>(
            type: T,
            ids: string[],
          ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
            const result: { [id: string]: SignalDataTypeMap[T] } = {};

            await Promise.all(
              ids.map(async (id) => {
                const key = `${type}-${id}`;
                const stored = await this.readData<unknown>(key);

                if (stored === null || stored === undefined) return;

                if (type === 'app-state-sync-key') {
                  try {
                    const converted =
                      proto.Message.AppStateSyncKeyData.fromObject(
                        stored as object,
                      );
                    result[id] = converted as unknown as SignalDataTypeMap[T];
                  } catch (error) {
                    const err = error as Error;
                    this.logger.warn(
                      { key, err },
                      'Chave app-state-sync-key inválida ao recuperar do banco',
                    );
                  }
                } else {
                  result[id] = stored as SignalDataTypeMap[T];
                }
              }),
            );

            return result;
          },

          set: async <T extends keyof SignalDataTypeMap>(
            data: Partial<{ [K in T]: { [id: string]: SignalDataTypeMap[K] } }>,
          ): Promise<void> => {
            const tasks: Promise<void>[] = [];

            for (const categoryKey in data) {
              const category = categoryKey as T;
              const categoryValues = data[category];

              if (!categoryValues) continue;
              for (const id in categoryValues) {
                const value = categoryValues[id];
                const key = `${category}-${id}`;

                if (value !== undefined && value !== null) {
                  tasks.push(this.writeData(value as unknown, key));
                } else {
                  tasks.push(this.removeData(key));
                }
              }
            }

            await Promise.all(tasks);
          },
        },
      },

      saveCreds: () => this.writeData(creds, 'creds'),
    };
  }

  private async writeData(data: unknown, key: string): Promise<void> {
    try {
      const jsonValue = JSON.stringify(data, BufferJSON.replacer);
      await this.sessionRepo.save({ key, value: jsonValue });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          { err: error, key },
          `❌ Erro ao salvar sessão: ${error.message}`,
        );
      } else {
        this.logger.error({ key, err: String(error) }, 'Erro desconhecido');
      }
    }
  }

  private async readData<T = unknown>(key: string): Promise<T | null> {
    try {
      const row = await this.sessionRepo.findOneBy({ key });
      if (!row) return null;

      return JSON.parse(row.value, BufferJSON.reviver) as T;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error({ err: error, key }, `⚠️ Erro ao ler sessão`);
      } else {
        this.logger.error({ key, err: String(error) }, 'Erro desconhecido');
      }
      return null;
    }
  }

  private async removeData(key: string): Promise<void> {
    try {
      await this.sessionRepo.delete({ key });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error({ err: error, key }, `❌ Erro ao remover sessão`);
      } else {
        this.logger.error({ key, err: String(error) }, 'Erro desconhecido');
      }
    }
  }

  public async clearSession(): Promise<void> {
    try {
      await this.sessionRepo.clear();
      this.logger.warn(`🧹 Sessão limpa do banco de dados.`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Falha ao limpar a sessão`, err);
    }
  }
}
