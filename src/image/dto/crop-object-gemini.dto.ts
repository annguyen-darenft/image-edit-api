import { IsNotEmpty, IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CropObjectGeminiDto {
  @ApiProperty({
    description: 'Name/identifier of the target object to isolate',
    example: 'cậu bé',
    minLength: 1,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  objectName: string;

  @ApiPropertyOptional({
    description: 'Additional description of the target object',
    example: 'tóc đen, đi chân đất, quấn khăn trên đầu',
  })
  @IsOptional()
  @IsString()
  objectDescription?: string;
}
