import { IsBoolean, IsOptional, IsString, IsNotEmpty } from "class-validator";

/**
 * DTO para aprovação de attendance
 */
export class ApproveAttendanceDTO {
  @IsNotEmpty({ message: "O ID da attendance é obrigatório" })
  @IsString()
  attendanceId!: string;

  @IsNotEmpty({ message: "O ID do hospital é obrigatório" })
  @IsString()
  hospitalId!: string;

  @IsOptional()
  @IsBoolean()
  applyDiscount?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}