import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class ObjectDescriptionDto {
  @ApiProperty({
    description: 'Object name (Vietnamese)',
    example: 'cậu bé',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Detailed object description (Vietnamese)',
    example: 'cậu bé, tóc đen, đi chân đất, quấn khăn trên đầu',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class DetectBoundingBoxesDto {
  @ApiProperty({
    description: 'List of objects to detect',
    type: [ObjectDescriptionDto],
    minItems: 1,
    maxItems: 25,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => ObjectDescriptionDto)
  objects: ObjectDescriptionDto[];
}
