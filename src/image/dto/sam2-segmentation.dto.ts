import {
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResponseFormat {
  JSON = 'json',
  ZIP = 'zip',
}

/**
 * SAM 2 automatic segmentation request DTO
 */
export class Sam2SegmentationDto {
  @ApiPropertyOptional({
    description: 'Number of points per side for mask generation (higher = more fine-grained masks)',
    minimum: 1,
    maximum: 64,
    default: 32,
    example: 32,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(64)
  points_per_side?: number = 32;

  @ApiPropertyOptional({
    description: 'Predicted IOU threshold for mask quality filtering',
    minimum: 0,
    maximum: 1,
    default: 0.88,
    example: 0.88,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  pred_iou_thresh?: number = 0.88;

  @ApiPropertyOptional({
    description: 'Stability score threshold for mask quality filtering',
    minimum: 0,
    maximum: 1,
    default: 0.95,
    example: 0.95,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  stability_score_thresh?: number = 0.95;

  @ApiPropertyOptional({
    description: 'Use Mask-to-Mask (M2M) refinement for better quality',
    default: true,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  use_m2m?: boolean = true;

  @ApiPropertyOptional({
    description: 'Response format: json (base64) or zip (downloadable)',
    enum: ResponseFormat,
    default: ResponseFormat.JSON,
    example: 'json',
  })
  @IsEnum(ResponseFormat)
  @IsOptional()
  format?: ResponseFormat = ResponseFormat.JSON;
}
