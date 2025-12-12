import { ApiProperty } from '@nestjs/swagger';

export class CroppedImageDto {
  @ApiProperty({
    description: 'Index of the cropped region',
    example: 0,
  })
  index: number;

  @ApiProperty({
    description: 'Base64-encoded image data with data URL prefix',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  data: string;

  @ApiProperty({
    description: 'Position of the crop region',
    example: { x: 100, y: 100 },
  })
  position: { x: number; y: number };

  @ApiProperty({
    description: 'Size of the cropped region',
    example: { width: 200, height: 200 },
  })
  size: { width: number; height: number };
}

export class BackgroundImageDto {
  @ApiProperty({
    description: 'Base64-encoded background image with data URL prefix',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  data: string;
}

export class CropMetadataDto {
  @ApiProperty({
    description: 'Original image dimensions',
    example: { width: 1920, height: 1080 },
  })
  originalDimensions: { width: number; height: number };

  @ApiProperty({
    description: 'Total number of regions cropped',
    example: 2,
  })
  totalRegions: number;

  @ApiProperty({
    description: 'Timestamp of the operation',
    example: '2025-12-12T16:15:00.000Z',
  })
  timestamp: string;
}

export class CropRegionsResponseDto {
  @ApiProperty({
    description: 'Array of cropped images with base64 data',
    type: [CroppedImageDto],
  })
  croppedImages: CroppedImageDto[];

  @ApiProperty({
    description: 'Background image with cropped regions marked transparent (null if not included)',
    type: BackgroundImageDto,
    nullable: true,
  })
  backgroundImage: BackgroundImageDto | null;

  @ApiProperty({
    description: 'Metadata about the crop operation',
    type: CropMetadataDto,
  })
  metadata: CropMetadataDto;
}
