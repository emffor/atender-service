import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type AttendanceType = "IN" | "OUT" | "LATE_IN" | "LATE_OUT";
export type AttendanceStatus = "PENDING" | "APPROVED" | "REJECTED";

@Index("ux_attendance_doctor_shift_type", ["doctorId", "shiftId", "type"], {
  unique: true,
})
@Entity("attendance")
export class Attendance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Referências por ID ao invés de relações diretas (dados vêm via RabbitMQ)
  @Column("uuid")
  shiftId!: string;

  @Column("uuid")
  doctorId!: string;

  @Column({ type: "enum", enum: ["IN", "OUT", "LATE_IN", "LATE_OUT"] })
  type!: AttendanceType;

  @Column("timestamptz")
  timestamp!: Date;

  @Column({ type: "varchar", length: 64, nullable: true })
  tz!: string | null;

  @Column({ type: "smallint", nullable: true })
  tzOffsetMin!: number | null;

  @Column({ type: "timestamp", nullable: true }) // sem time zone
  localTimestamp!: Date | null;
  
  @Column("decimal", { precision: 10, scale: 7 })
  latitude!: number;

  @Column("decimal", { precision: 10, scale: 7 })
  longitude!: number;

  @Column({ type: "text", nullable: true })
  photoS3Key?: string;

  @Column({ type: "text", nullable: true })
  reason?: string; // Motivo fornecido pelo USUÁRIO (médico)

  @Column({ type: "text", nullable: true })
  statusReason?: string; // Motivo gerado pelo SISTEMA (automático)

  @Column({
    type: "enum",
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING",
  })
  status!: AttendanceStatus;

  // Controle de atraso e desconto
  @Column({ type: "boolean", default: false })
  isLate!: boolean; // Se houve atraso

  @Column({ type: "int", default: 0 })
  lateMinutes!: number; // Quantos minutos de atraso

  @Column({ type: "boolean", default: false })
  hasAutomaticDiscount!: boolean; // Se foi aplicado desconto automático

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  discountPercentage!: number; // Percentual de desconto aplicado (0-100%)

  @Column({ type: "boolean", default: false })
  approvedWithDiscount!: boolean; // Se foi aprovado com desconto

  @CreateDateColumn() 
  createdAt!: Date;
  
  @UpdateDateColumn() 
  updatedAt!: Date;
}