import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'whatsapp_sessions' })
export class WhatsAppSession {
  @PrimaryColumn()
  sessionId: string;

  @PrimaryColumn()
  key: string;

  @Column({ type: 'text' })
  value: string;
}
