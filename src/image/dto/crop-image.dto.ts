import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsBoolean,
  IsEnum,
  ArrayMinSize,
  ArrayMaxSize,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum CropResponseFormat {
  JSON = 'json',
  ZIP = 'zip',
}

export class CropPositionDto {
  @ApiProperty({
    description: 'X coordinate (left edge)',
    example: 100,
    minimum: 0,
    maximum: 65535,
  })
  @IsInt()
  @Min(0)
  @Max(65535)
  x: number;

  @ApiProperty({
    description: 'Y coordinate (top edge)',
    example: 100,
    minimum: 0,
    maximum: 65535,
  })
  @IsInt()
  @Min(0)
  @Max(65535)
  y: number;
}

export class CropSizeDto {
  @ApiProperty({
    description: 'Width of crop region',
    example: 200,
    minimum: 1,
    maximum: 65535,
  })
  @IsInt()
  @Min(1)
  @Max(65535)
  w: number;

  @ApiProperty({
    description: 'Height of crop region',
    example: 200,
    minimum: 1,
    maximum: 65535,
  })
  @IsInt()
  @Min(1)
  @Max(65535)
  h: number;
}

export class CropRegionDto {
  @ApiProperty({
    description: 'Position of crop region',
    type: CropPositionDto,
  })
  @ValidateNested()
  @Type(() => CropPositionDto)
  position: CropPositionDto;

  @ApiProperty({
    description: 'Size of crop region',
    type: CropSizeDto,
  })
  @ValidateNested()
  @Type(() => CropSizeDto)
  size: CropSizeDto;
}

export class CropImageDto {
  @ApiProperty({
    description: 'Array of crop regions to extract from the image',
    type: [CropRegionDto],
    example: [
      { position: { x: 0, y: 0 }, size: { w: 100, h: 100 } },
      { position: { x: 200, y: 200 }, size: { w: 150, h: 150 } },
    ],
    minItems: 1,
    maxItems: 20,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CropRegionDto)
  regions: CropRegionDto[];

  @ApiProperty({
    description: 'Whether to include background image with cropped regions marked',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return true; // default
  })
  includeBackground?: boolean = true;

  @ApiProperty({
    description: 'Response format: json (default) or zip',
    enum: CropResponseFormat,
    example: CropResponseFormat.JSON,
    default: CropResponseFormat.JSON,
    required: false,
  })
  @IsOptional()
  @IsEnum(CropResponseFormat)
  format?: CropResponseFormat = CropResponseFormat.JSON;
}
