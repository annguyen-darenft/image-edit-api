import { ApiProperty } from '@nestjs/swagger';

export class PositionDto {
  @ApiProperty({
    description: 'X coordinate (pixels from left)',
    example: 245,
  })
  x: number;

  @ApiProperty({
    description: 'Y coordinate (pixels from top)',
    example: 180,
  })
  y: number;
}

export class SizeDto {
  @ApiProperty({
    description: 'Width in pixels',
    example: 320,
  })
  w: number;

  @ApiProperty({
    description: 'Height in pixels',
    example: 580,
  })
  h: number;
}

export class BoundingBoxDto {
  @ApiProperty({
    description: 'Object name',
    example: 'cậu bé',
  })
  object: string;

  @ApiProperty({
    description: 'Top-left corner position',
    type: PositionDto,
  })
  position: PositionDto;

  @ApiProperty({
    description: 'Bounding box dimensions',
    type: SizeDto,
  })
  size: SizeDto;
}

export class DetectBoundingBoxesResponseDto {
  @ApiProperty({
    description: 'Detected bounding boxes',
    type: [BoundingBoxDto],
  })
  boundingBoxes: BoundingBoxDto[];

  @ApiProperty({
    description: 'Number of detected objects',
    example: 2,
  })
  totalDetected: number;

  @ApiProperty({
    description: 'Processing timestamp',
    example: '2025-12-15T11:30:00.000Z',
  })
  timestamp: string;
}
