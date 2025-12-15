import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
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

export class ImageSizeDto {
  @ApiProperty({
    description: 'Image width in pixels',
    example: 2047,
    minimum: 1,
    maximum: 10000,
  })
  @IsNumber()
  @Min(1)
  @Max(10000)
  width: number;

  @ApiProperty({
    description: 'Image height in pixels',
    example: 1535,
    minimum: 1,
    maximum: 10000,
  })
  @IsNumber()
  @Min(1)
  @Max(10000)
  height: number;
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

  @ApiProperty({
    description: 'Original image dimensions',
    type: ImageSizeDto,
  })
  @ValidateNested()
  @Type(() => ImageSizeDto)
  imageSize: ImageSizeDto;
}
