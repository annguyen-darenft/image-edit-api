import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Individual segmentation mask
 */
export class SegmentationMaskDto {
  @ApiProperty({
    description: 'Mask index',
    example: 0,
  })
  index: number;

  @ApiProperty({
    description: 'Base64-encoded PNG mask image (data URL format)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  data: string;
}

/**
 * Combined mask (all objects in single mask)
 */
export class CombinedMaskDto {
  @ApiProperty({
    description: 'Base64-encoded PNG combined mask (data URL format)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  data: string;
}

/**
 * Metadata about the segmentation operation
 */
export class SegmentationMetadataDto {
  @ApiProperty({
    description: 'Original image dimensions',
    example: { width: 1920, height: 1080 },
  })
  originalDimensions: {
    width: number;
    height: number;
  };

  @ApiProperty({
    description: 'Total number of individual masks generated',
    example: 12,
  })
  totalIndividualMasks: number;

  @ApiProperty({
    description: 'Number of points per side used',
    example: 32,
  })
  pointsPerSide: number;

  @ApiPropertyOptional({
    description: 'Predicted IOU threshold used',
    example: 0.88,
  })
  predIouThresh?: number;

  @ApiPropertyOptional({
    description: 'Stability score threshold used',
    example: 0.95,
  })
  stabilityScoreThresh?: number;

  @ApiPropertyOptional({
    description: 'Whether M2M refinement was used',
    example: true,
  })
  useM2m?: boolean;

  @ApiProperty({
    description: 'Processing timestamp',
    example: '2025-12-16T16:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 11250,
  })
  processingTimeMs: number;
}

/**
 * SAM 2 automatic segmentation response (JSON format)
 */
export class Sam2SegmentationResponseDto {
  @ApiProperty({
    description: 'Combined mask with all detected objects',
    type: CombinedMaskDto,
  })
  combinedMask: CombinedMaskDto;

  @ApiProperty({
    description: 'Array of individual object masks',
    type: [SegmentationMaskDto],
  })
  individualMasks: SegmentationMaskDto[];

  @ApiProperty({
    description: 'Metadata about the segmentation operation',
    type: SegmentationMetadataDto,
  })
  metadata: SegmentationMetadataDto;
}
