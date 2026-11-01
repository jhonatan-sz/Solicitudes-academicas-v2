import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class ChangeStatusDto {
  @ApiProperty({
    description: 'Nuevo estado para la solicitud',
    enum: RequestStatus,
    example: 'IN_REVIEW',
  })
  @IsEnum(RequestStatus)
  newStatus: RequestStatus;

  @ApiPropertyOptional({
    description:
      'Comentario explicando el cambio de estado (requerido al rechazar, mínimo 10 caracteres)',
    example: 'Documentación incompleta, falta récord académico',
    minLength: 10,
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o: ChangeStatusDto) => o.newStatus === RequestStatus.REJECTED)
  @MinLength(10, { message: 'El comentario debe tener al menos 10 caracteres' })
  comment?: string;
}
