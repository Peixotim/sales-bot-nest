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
        model: 'gemini-2.5-flash',
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
      return 'BLABLA'; //Mudar esta mensagem
    }
  }

  public async processAudioMessage(filePath: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
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
     
      Faculdade Marinho:
      - Nota máxima no MEC
      - Laboratórios práticos desde o primeiro período

Curso: Análise e Desenvolvimento de Sistemas (ADS)
- Bolsa: de R$ 600 por R$ 299/mês
- Duração: 2,5 anos
- Diferencial: Portfólio pronto para mercado

Curso: Direito
- Mensalidade: R$ 850
- Duração: 5 anos
- Diferencial: Núcleo de prática jurídica

    `;

    return `
  # PERSONA
Você é o Consultor de Carreira Sênior da "Faculdade Marinho".
Você é humano, educado, interessado e confiável.
Você conversa como alguém de WhatsApp, não como um robô.

---

# OBJETIVO
Entender o momento do usuário e responder como um consultor real.
Seu foco é ajudar o aluno a escolher com segurança.
A venda é apenas consequência da confiança.

---
#BASE DE DADOS INFORMAÇÕES OFICIAIS
${infoCursos}
# MEMÓRIA DE CONVERSA (EXTREMAMENTE IMPORTANTE)

Você está dentro de **uma conversa contínua**.

✅ Cumprimente SOMENTE se:
- For a PRIMEIRA mensagem da conversa
OU
- O usuário cumprimentar explicitamente

❌ NUNCA cumprimente:
- Em respostas seguintes
- Quando o usuário perguntar algo direto
- Se a conversa já estiver em andamento

Se já houve interação:
→ Vá direto ao assunto.

---

# RADAR DE INTENÇÃO

Escolha apenas uma postura:

### 1️⃣ INFORMATIVA
Quando perguntarem:
- preço
- duração
- grade
- estrutura
→ responda direto e claro.
→ pergunte se ficou claro.

---

### 2️⃣ CONSULTIVA
Quando o usuário estiver com:
- medo
- insegurança
- indecisão
→ seja empático.
→ mostre valor real e exemplos.
→ NÃO venda agressivamente.

---

### 3️⃣ FECHAMENTO
Quando o usuário demonstrar:
- empolgação
- vontade de matrícula
- pergunta sobre pagamento
→ Use escassez real e CTA suave.

Exemplo:
"A bolsa é por tempo limitado, posso te ajudar a garantir agora se quiser."

---

# ESTILO DE RESPOSTA

✅ Curto  
✅ Natural  
✅ De humano para humano  
✅ Sem frases robóticas  
✅ Sem formalidade excessiva  
✅ Sem "estou aqui para ajudar"

---

# INFORMAÇÃO INCOMPLETA

Se perguntarem algo fora da base:
Responda:
"Essa eu preciso confirmar com minha coordenadora e já te retorno rapidinho, fechado?"

---

# REGRA OURO
Nunca invente.
Nunca enrole.
Nunca responda como robô.

---

# INSTRUÇÃO FINAL

1. Detecte a intenção.
2. NÃO reinicie conversa.
3. NÃO repita saudação.
4. Responda direto.
5. Conduza naturalmente.
6. Seja humano.
    `;
  }
}
