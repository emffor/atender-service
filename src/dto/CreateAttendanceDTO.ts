import { IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean, Min, Max } from "class-validator";

/**
 * Tipos de attendance
 */
export enum AttendanceType {
  IN = 'IN',
  OUT = 'OUT'
}

/**
 * DTO para criação de attendance (registro de ponto)
 */
export class CreateAttendanceDTO {
  @IsNotEmpty({ message: "O ID do médico é obrigatório" })
  @IsString()
  doctorId!: string;

  @IsNotEmpty({ message: "O ID do plantão é obrigatório" })
  @IsString()
  shiftId!: string;

  @IsNotEmpty({ message: "O tipo de ponto é obrigatório" })
  type!: AttendanceType;

  @IsNotEmpty({ message: "A latitude é obrigatória" })
  @IsNumber()
  @Min(-90, { message: "Latitude deve estar entre -90 e 90" })
  @Max(90, { message: "Latitude deve estar entre -90 e 90" })
  latitude!: number;

  @IsNotEmpty({ message: "A longitude é obrigatória" })
  @IsNumber()
  @Min(-180, { message: "Longitude deve estar entre -180 e 180" })
  @Max(180, { message: "Longitude deve estar entre -180 e 180" })
  longitude!: number;

  @IsNotEmpty({ message: "A foto é obrigatória" })
  photo!: {
    buffer: Buffer;
    mimetype: string;
    originalname?: string;
  };

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  useFaceRecognition?: boolean;
}