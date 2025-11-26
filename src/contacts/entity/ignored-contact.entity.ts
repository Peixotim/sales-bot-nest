import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
@Entity('ignored_contacts')
export class IgnoredContact {
  @PrimaryColumn()
  jid: string;

  @Column({ nullable: true })
  name: string;

  @CreateDateColumn()
  createdAt: Date;
}
