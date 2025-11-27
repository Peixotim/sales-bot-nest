import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { EnterpriseEntity } from 'src/enterprise/entity/enterprise.entity';

@Entity({ name: 'Consultant' })
export class ConsultantEntity {
  @PrimaryColumn({ type: 'varchar' })
  number: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 120 })
  password: string;

  @ManyToOne(() => EnterpriseEntity, (enterprise) => enterprise.consultants)
  enterprise: EnterpriseEntity;
}
