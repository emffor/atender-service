import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * DTO para rejeição de attendance
 */
export class RejectAttendanceDTO {
  @IsNotEmpty({ message: "O ID da attendance é obrigatório" })
  @IsString()
  attendanceId!: string;

  @IsNotEmpty({ message: "O ID do hospital é obrigatório" })
  @IsString()
  hospitalId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}