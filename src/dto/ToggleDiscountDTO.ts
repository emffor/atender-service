import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * DTO para alternar desconto de attendance
 */
export class ToggleDiscountDTO {
  @IsNotEmpty({ message: "O ID é obrigatório" })
  @IsString()
  id!: string; // pode ser attendanceId ou shiftId

  @IsNotEmpty({ message: "O ID do hospital é obrigatório" })
  @IsString()
  hospitalId!: string;

  @IsNotEmpty({ message: "O campo useDiscount é obrigatório" })
  @IsBoolean()
  useDiscount!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}