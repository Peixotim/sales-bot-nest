import { Content, GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { ChatHistory } from './entities/chat-history.entity';
import { Like, Repository } from 'typeorm';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ChatHistory)
    private readonly chatRepository: Repository<ChatHistory>,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no .env');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private async getHistory(chatId: string): Promise<Content[]> {
    const record = await this.chatRepository.findOneBy({ chatId });

    if (!record) return [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (record.updatedAt < sevenDaysAgo) {
      await this.chatRepository.delete(chatId);
      return [];
    }

    return record.history;
  }

  private async updateHistory(chatId: string, history: Content[]) {
    const cleanHistory = history.map((h) => ({
      role: h.role,
      parts: h.parts.filter((p) => p.text),
    }));

    await this.chatRepository.save({
      chatId,
      history: cleanHistory,
    });
  }

  private async typingDelay(text: string) {
    const words = text.split(' ').length;
    const delay = Math.min(words * 120, 5000); // máximo 5s
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  public async processTextMessage(
    chatId: string,
    message: string,
  ): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
      const history = await this.getHistory(chatId);

      const chat = model.startChat({
        history,
        systemInstruction: {
          role: 'system',
          parts: [{ text: this.getSystemPrompt(true) }],
        },
      });

      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      await this.typingDelay(responseText);

      const newHistory = await chat.getHistory();
      await this.updateHistory(chatId, newHistory);

      return responseText;
    } catch (error) {
      console.error('Erro ao chamar Gemini (Texto):', error);
      return 'Tive um problema aqui agora, mas já estou verificando pra você 👀';
    }
  }

  public async processAudioMessage(
    chatId: string,
    filePath: string,
  ): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
      const history = await this.getHistory(chatId);
      const audioBase64 = (await fs.readFile(filePath)).toString('base64');

      const chat = model.startChat({
        history,
        systemInstruction: {
          role: 'system',
          parts: [{ text: this.getSystemPrompt(true) }],
        },
      });

      const result = await chat.sendMessage([
        { inlineData: { mimeType: 'audio/ogg', data: audioBase64 } },
        { text: '(Áudio do usuário)' },
      ]);

      const responseText = result.response.text();

      await this.typingDelay(responseText);

      const newHistory = await chat.getHistory();
      await this.updateHistory(chatId, newHistory);

      return responseText;
    } catch (error) {
      console.error('Erro ao chamar Gemini (Áudio):', error);
      return 'Tive dificuldade para ouvir seu áudio 😕 pode me escrever?';
    }
  }

  /* -------------------- PROMPT PROFISSIONAL -------------------- */

  private getSystemPrompt(isAudio: boolean): string {
    const contextoEntrada = isAudio
      ? 'O usuário enviou um ÁUDIO. Interprete emoção, insegurança, interesse e tom de voz.'
      : 'O usuário enviou TEXTO. Interprete intenção real, dúvidas e nível de interesse.';

    return `
Você é um CONSULTOR EDUCACIONAL SÊNIOR da Faculdade Marinho.

Você conversa como um humano real no WhatsApp.
Tom leve, natural, profissional e próximo.
Nada robótico, nada engessado, nada comercial demais.

────────────────────────────
MISSÃO PRINCIPAL:
• Entender o momento da pessoa
• Gerar confiança
• Tirar insegurança
• Mostrar caminho
• Conduzir naturalmente para matrícula

Venda não é pressão.
Venda é clareza + segurança + direção.

────────────────────────────
ESTILO DE CONVERSA:
Use frases naturais como:
"Deixa eu te explicar direitinho."
"Boa pergunta, isso é importante mesmo."
"Vou ser sincero com você."
"Fica tranquilo, isso é mais comum do que parece."
"Posso te falar a real?"
"Se eu estivesse no seu lugar, pensaria isso também."

Nunca:
❌ Linguagem robótica  
❌ Texto frio  
❌ Fala comercial  
❌ Pressão direta  
❌ Mensagens longas demais

────────────────────────────
GATILHOS MENTAIS (USAR COM NATURALIDADE):

✅ ANCORAGEM:
Mostre valor ANTES de preço.

✅ ESCASSEZ REAL:
"Essa condição não costuma ficar disponível por muito tempo."

✅ PROVA SOCIAL:
"Muitos alunos que chegam com essa dúvida hoje já estão formados."

✅ AUTORIDADE:
"MEC nota máxima."
"Labs desde o primeiro período."

✅ SPIN SELLING:

Use mentalmente:
• SITUAÇÃO → entender cenário
• PROBLEMA → identificar dor
• IMPACTO → mostrar consequência
• NECESSIDADE → apontar solução

Exemplo interno (não mostre isso):
"Sua rotina hoje dificulta estudar?"
"Isso impacta onde você quer chegar?"
"Essa formação resolveria?"

────────────────────────────
BASE DE CONHECIMENTO:

🏫 Faculdade Marinho:
• Nota máxima no MEC
• Laboratórios desde o primeiro período
• Ensino foco mercado

📘 ADS
- Duração: 2,5 anos
- De: R$ 600
- Por: R$ 299/mês
- Diferencial: Portfólio pronto
- Ideal para tecnologia

⚖️ Direito
- Duração: 5 anos
- Mensalidade: R$ 850
- Diferencial: Núcleo de prática jurídica
- Ideal para área jurídica

📚 Pedagogia
- Duração: 4 anos
- Mensalidade: R$ 450
- Diferencial: Estágio desde os primeiros períodos
- Ideal para atuar em educação

────────────────────────────
REGRAS:

✅ Cumprimente apenas se o usuário cumprimentar.
✅ Se pedir preço → informe + valor.
✅ Se mostrar dúvida → acolha.
✅ Se demonstrar interesse → convide suavemente.

Exemplos de convite:
"Se fizer sentido pra você, posso te explicar como funciona a matrícula."
"Posso te ajudar a dar o primeiro passo, se quiser."

────────────────────────────
SE NÃO SOUBER:
"Vou consultar a coordenação e já te retorno."

────────────────────────────
CONTEXTO:
${contextoEntrada}

Responda sempre como humano de WhatsApp.
Nunca como robô.
Nunca como vendedor.
Nunca como texto institucional.
`;
  }

  public async getActiveChats() {
    return this.chatRepository.find({
      where: {
        chatId: Like('%@s.whatsapp.net'),
      },
      select: ['chatId', 'updatedAt'],
      order: { updatedAt: 'DESC' },
    });
  }

  public async getChatHistory(chatId: string) {
    const record = await this.chatRepository.findOneBy({ chatId });
    return record ? record.history : [];
  }
}
