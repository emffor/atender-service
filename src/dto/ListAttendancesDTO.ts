import { IsOptional, IsString, IsNumber, Min, IsEnum } from "class-validator";
import { AttendanceStatus } from "../entities/Attendance";

/**
 * DTO para listagem de attendances
 */
export class ListAttendancesDTO {
  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsEnum(["PENDING", "APPROVED", "REJECTED"])
  status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  uptoDate?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}