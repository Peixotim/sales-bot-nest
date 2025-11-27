import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { ConsultantEntity } from 'src/consultant/entity/consultant.entity';
@Entity({ name: 'enterprise' })
export class EnterpriseEntity {
  @PrimaryColumn()
  cnpj: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', length: 120 })
  mail: string;

  @Column({ type: 'varchar', length: 120 })
  password: string;

  @OneToMany(() => ConsultantEntity, (consultant) => consultant.enterprise)
  consultants: ConsultantEntity[];
}
