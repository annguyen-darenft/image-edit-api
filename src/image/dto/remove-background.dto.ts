import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RemoveBackgroundDto {
  @ApiProperty({
    description: 'Background color to remove',
    example: '#FFFFFF',
    default: '#FFFFFF',
    required: false,
  })
  @IsOptional()
  @IsString()
  backgroundColor?: string = '#FFFFFF';
}
