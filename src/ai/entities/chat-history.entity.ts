import { Content } from '@google/generative-ai';
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class ChatHistory {
  @PrimaryColumn()
  chatId: string; //Numero de telefone

  //Guardar o historico do gemini
  @Column({ type: 'jsonb', default: [] })
  history: Content[];

  @UpdateDateColumn()
  updatedAt: Date;
}
