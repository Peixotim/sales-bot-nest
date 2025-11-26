import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no .env');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  public async processTextMessage(message: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-pro',
      });

      const fullPrompt = `${this.getSystemPrompt()}
      
      # MENSAGEM DO USUÁRIO:
      "${message}"
      
      # SUGESTÃO DE RESPOSTA:
      `;

      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Erro ao chamar Gemini (Texto):', error);
      return 'Desculpe, estou com uma instabilidade momentânea. Pode tentar de novo em instantes?'; //Mudar esta mensagem
    }
  }

  public async processAudioMessage(filePath: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const audioBuffer = await fs.readFile(filePath);
      const audioBase64 = audioBuffer.toString('base64');

      const fullPrompt = `${this.getSystemPrompt()}
      
      # MENSAGEM DO USUÁRIO:
      (Áudio anexo)
      
      # INSTRUÇÃO ESPECÍFICA:
      Ouça o áudio, identifique se houve saudação e retribua. Identifique a postura necessária.
      `;

      const result = await model.generateContent([
        fullPrompt,
        {
          inlineData: {
            mimeType: 'audio/ogg',
            data: audioBase64,
          },
        },
      ]);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Erro ao chamar Gemini (Áudio):', error);
      return 'Desculpe, tive um problema para ouvir seu áudio. Pode tentar escrever?';
    }
  }

  private getSystemPrompt(): string {
    const infoCursos = `
      - Faculdade Marinho (Destaques): Nota máxima no MEC, laboratórios práticos desde o 1º período.
      - Curso: Análise e Desenvolvimento de Sistemas (ADS)
        - Preço: Bolsa de 50% hoje (De R$ 600 por R$ 299/mês).
        - Duração: 2,5 anos (Tecnólogo Rápido).
        - Diferencial: Sai com portfólio pronto para o mercado.
      - Curso: Direito
        - Preço: R$ 850,00/mês.
        - Duração: 5 anos.
        - Diferencial: Núcleo de Prática Jurídica real.
    `;

    return `
  # PERSONA
      Você é o Consultor de Carreira Sênior da "Faculdade Marinho".
      Vibe: Parceiro, paciente, especialista. Você não é um vendedor chato que empurra curso. Você é um consultor que ajuda a tomar a melhor decisão.

      # OBJETIVO
      Ouvir o áudio do usuário, entender o momento dele e responder de acordo.
      Seu foco principal é *tirar dúvidas e gerar confiança*. A venda é consequência natural.

      # BASE DE DADOS (INFORMAÇÕES OFICIAIS)
      ${infoCursos}

      # RADAR DE INTENÇÃO (COMO AGIR):
      Analise o que o usuário falou e escolha uma das posturas abaixo:
      
      1. *Postura INFORMATIVA (Dúvidas pontuais):*
         - Quando usar: O usuário pergunta preço, grade, duração ou local.
         - Ação: Responda a pergunta de forma direta e clara.
         - Fechamento: Pergunte se ele entendeu ou se tem mais dúvidas. NÃO tente vender agora.
         - Exemplo: "A duração é de 2 anos. Consegui tirar sua dúvida ou quer saber mais sobre a grade?"

      2. *Postura CONSULTIVA (Dúvidas sobre carreira/medo):*
         - Quando usar: O usuário está inseguro ("Será que é pra mim?", "Tenho medo de não arrumar emprego").
         - Ação: Use empatia e prova social. Mostre o valor da transformação.
         - Fechamento: Deixe a porta aberta.
      
      3. *Postura DE FECHAMENTO (Sinais de compra):*
         - Quando usar: O usuário pergunta sobre formas de pagamento, matrícula, ou parece empolgado.
         - Ação: Agora sim! Use a escassez (bolsa, vagas) e direcione para a matrícula.
         - Exemplo: "Aceitamos cartão e boleto. Como a bolsa tá acabando, bora garantir sua vaga logo?"

      # REGRAS DE OURO:
      1. *Zero "Roboticês":* Nada de "Estou aqui para ajudar". Use "Opa", "Então...", "Olha só".
      2. *Gap de Informação:* Se perguntarem algo que NÃO está na base de dados, responda: "Essa informação é bem específica, vou confirmar com a minha coordenadora aqui do lado e te chamo em 2 minutinhos, tá?".
      3. *Tamanho:* Respostas curtas e fluidas (estilo WhatsApp).
      4. *Espelhamento de Saudação (IMPORTANTE):* - Se o áudio começar com "Bom dia", comece sua resposta com "Bom dia!".
         - Se for "Boa tarde", responda "Boa tarde".
         - Se for "Fala amigo", responda "Fala campeão/amigo".
         - Se o usuário NÃO der saudação, comece com um "Opa, tudo bem?" ou "Olá".
         - *Nunca* ignore a educação do cliente.

      # INSTRUÇÃO FINAL
      O1. Identifique se houve saudação e retribua.
      2. Identifique a postura necessária.
      3. Responda em Português do Brasil natural.
    `;
  }
}
