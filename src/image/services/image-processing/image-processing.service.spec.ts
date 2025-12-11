import { Test, TestingModule } from '@nestjs/testing';
import { ImageProcessingService } from './image-processing.service';
import sharp from 'sharp';
import { RGBColor } from '../color-parser/color-parser.service';

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageProcessingService],
    }).compile();

    service = module.get<ImageProcessingService>(ImageProcessingService);
  });

  describe('removeBackground', () => {
    it('should remove white background from test image', async () => {
      // Create test image: 100x100 white background
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const whiteColor: RGBColor = { r: 255, g: 255, b: 255 };
      const result = await service.removeBackground(testImage, {
        backgroundColor: whiteColor,
      });

      // Verify result is valid PNG
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Verify PNG has transparency
      const metadata = await sharp(result).metadata();
      expect(metadata.channels).toBe(4); // RGBA
      expect(metadata.hasAlpha).toBe(true);
    });

    it('should handle image with mixed colors', async () => {
      // Create test image: white background with red square
      const testImage = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite([
          {
            input: await sharp({
              create: {
                width: 50,
                height: 50,
                channels: 4,
                background: { r: 255, g: 0, b: 0, alpha: 1 },
              },
            })
              .png()
              .toBuffer(),
            top: 75,
            left: 75,
          },
        ])
        .png()
        .toBuffer();

      const result = await service.removeBackground(testImage, {
        backgroundColor: { r: 255, g: 255, b: 255 },
      });

      // Should produce valid transparent PNG
      const metadata = await sharp(result).metadata();
      expect(metadata.hasAlpha).toBe(true);
    });

    it('should process JPEG input', async () => {
      // Create JPEG test image
      const jpegImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await service.removeBackground(jpegImage, {
        backgroundColor: { r: 255, g: 255, b: 255 },
      });

      // Should convert to PNG with alpha
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.hasAlpha).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const invalidBuffer = Buffer.from('invalid image data');

      await expect(
        service.removeBackground(invalidBuffer, {
          backgroundColor: { r: 255, g: 255, b: 255 },
        }),
      ).rejects.toThrow();
    });
  });
});
