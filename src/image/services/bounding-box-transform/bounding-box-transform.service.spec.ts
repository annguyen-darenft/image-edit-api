import { Test, TestingModule } from '@nestjs/testing';
import { BoundingBoxTransformService } from './bounding-box-transform.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('BoundingBoxTransformService', () => {
  let service: BoundingBoxTransformService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BoundingBoxTransformService],
    }).compile();

    service = module.get<BoundingBoxTransformService>(
      BoundingBoxTransformService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transform', () => {
    it('should convert Gemini format to API format with exact match', () => {
      const geminiBoundingBoxes = [
        {
          label: 'cậu bé',
          box_2d: [100, 200, 600, 700] as [number, number, number, number], // [y_min, x_min, y_max, x_max]
        },
      ];

      const objectDescriptions = [{ name: 'cậu bé', description: 'tóc đen' }];

      const imageSize = { width: 2047, height: 1535 };

      const result = service.transform(
        geminiBoundingBoxes,
        objectDescriptions,
        imageSize,
      );

      expect(result).toHaveLength(1);
      expect(result[0].object).toBe('cậu bé');

      // Verify coordinate conversion: (200/1000) * 2047 = 409.4 ≈ 409
      expect(result[0].position.x).toBe(409);
      // Verify coordinate conversion: (100/1000) * 1535 = 153.5 ≈ 154
      expect(result[0].position.y).toBe(154);
      // Width: ((700-200)/1000) * 2047 = 1023.5 ≈ 1024
      expect(result[0].size.w).toBe(1024);
      // Height: ((600-100)/1000) * 1535 = 767.5 ≈ 768
      expect(result[0].size.h).toBe(768);
    });

    it('should handle multiple bounding boxes', () => {
      const geminiBoundingBoxes = [
        {
          label: 'cậu bé',
          box_2d: [100, 200, 300, 400] as [number, number, number, number],
        },
        {
          label: 'bà cụ',
          box_2d: [500, 600, 800, 900] as [number, number, number, number],
        },
      ];

      const objectDescriptions = [
        { name: 'cậu bé', description: 'test1' },
        { name: 'bà cụ', description: 'test2' },
      ];

      const imageSize = { width: 1000, height: 1000 };

      const result = service.transform(
        geminiBoundingBoxes,
        objectDescriptions,
        imageSize,
      );

      expect(result).toHaveLength(2);
      expect(result[0].object).toBe('cậu bé');
      expect(result[1].object).toBe('bà cụ');
    });

    it('should throw error for out-of-bounds coordinates', () => {
      const geminiBoundingBoxes = [
        {
          label: 'test',
          box_2d: [900, 900, 1100, 1100] as [number, number, number, number], // Exceeds image bounds
        },
      ];

      const objectDescriptions = [{ name: 'test', description: 'test' }];
      const imageSize = { width: 1000, height: 1000 };

      expect(() => {
        service.transform(geminiBoundingBoxes, objectDescriptions, imageSize);
      }).toThrow(InternalServerErrorException);
    });

    it('should throw error for negative coordinates', () => {
      const geminiBoundingBoxes = [
        {
          label: 'test',
          box_2d: [-100, -100, 100, 100] as [number, number, number, number],
        },
      ];

      const objectDescriptions = [{ name: 'test', description: 'test' }];
      const imageSize = { width: 1000, height: 1000 };

      expect(() => {
        service.transform(geminiBoundingBoxes, objectDescriptions, imageSize);
      }).toThrow(InternalServerErrorException);
    });

    it('should throw error for zero or negative size', () => {
      const geminiBoundingBoxes = [
        {
          label: 'test',
          box_2d: [100, 100, 100, 100] as [number, number, number, number], // Zero width and height
        },
      ];

      const objectDescriptions = [{ name: 'test', description: 'test' }];
      const imageSize = { width: 1000, height: 1000 };

      expect(() => {
        service.transform(geminiBoundingBoxes, objectDescriptions, imageSize);
      }).toThrow(InternalServerErrorException);
    });
  });

  describe('findMatchingObject', () => {
    it('should match exactly', () => {
      const objectDescriptions = [{ name: 'cậu bé', description: 'test' }];
      const result = (service as any).findMatchingObject(
        'cậu bé',
        objectDescriptions,
      );
      expect(result).toBe('cậu bé');
    });

    it('should match partially', () => {
      const objectDescriptions = [{ name: 'cậu bé', description: 'test' }];
      const result = (service as any).findMatchingObject(
        'boy cậu bé',
        objectDescriptions,
      );
      expect(result).toBe('cậu bé');
    });

    it('should fall back to Gemini label if no match', () => {
      const objectDescriptions = [{ name: 'cậu bé', description: 'test' }];
      const result = (service as any).findMatchingObject(
        'unknown object',
        objectDescriptions,
      );
      expect(result).toBe('unknown object');
    });
  });
});
