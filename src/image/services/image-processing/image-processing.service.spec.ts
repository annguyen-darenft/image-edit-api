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

  describe('cropRegions', () => {
    it('should crop single region from image', async () => {
      // Create test image: 400x400 white
      const testImage = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await service.cropRegions(
        testImage,
        [{ position: { x: 50, y: 50 }, size: { w: 100, h: 100 } }],
        true,
      );

      expect(result.croppedImages).toHaveLength(1);
      expect(result.croppedImages[0]).toBeInstanceOf(Buffer);

      // Verify cropped image dimensions
      const metadata = await sharp(result.croppedImages[0]).metadata();
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    });

    it('should crop multiple regions in parallel', async () => {
      // Create test image
      const testImage = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 4,
          background: { r: 200, g: 200, b: 200, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const regions = [
        { position: { x: 0, y: 0 }, size: { w: 100, h: 100 } },
        { position: { x: 200, y: 200 }, size: { w: 150, h: 150 } },
        { position: { x: 400, y: 0 }, size: { w: 100, h: 200 } },
      ];

      const result = await service.cropRegions(testImage, regions, true);

      expect(result.croppedImages).toHaveLength(3);
      expect(result.metadata.croppedRegions).toHaveLength(3);

      // Verify each crop
      const metadata0 = await sharp(result.croppedImages[0]).metadata();
      expect(metadata0.width).toBe(100);
      expect(metadata0.height).toBe(100);

      const metadata1 = await sharp(result.croppedImages[1]).metadata();
      expect(metadata1.width).toBe(150);
      expect(metadata1.height).toBe(150);

      const metadata2 = await sharp(result.croppedImages[2]).metadata();
      expect(metadata2.width).toBe(100);
      expect(metadata2.height).toBe(200);
    });

    it('should generate background image with transparent regions', async () => {
      // Create test image
      const testImage = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 4,
          background: { r: 100, g: 150, b: 200, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await service.cropRegions(
        testImage,
        [{ position: { x: 50, y: 50 }, size: { w: 100, h: 100 } }],
        true,
      );

      expect(result.backgroundImage).not.toBeNull();
      expect(result.backgroundImage).toBeInstanceOf(Buffer);

      // Verify background has correct dimensions
      const metadata = await sharp(result.backgroundImage!).metadata();
      expect(metadata.width).toBe(300);
      expect(metadata.height).toBe(300);
      expect(metadata.hasAlpha).toBe(true);
    });

    it('should not include background when disabled', async () => {
      const testImage = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await service.cropRegions(
        testImage,
        [{ position: { x: 0, y: 0 }, size: { w: 50, h: 50 } }],
        false,
      );

      expect(result.backgroundImage).toBeNull();
      expect(result.croppedImages).toHaveLength(1);
    });

    it('should validate regions against image dimensions', async () => {
      const testImage = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      // Region extends beyond image width
      await expect(
        service.cropRegions(
          testImage,
          [{ position: { x: 150, y: 0 }, size: { w: 100, h: 50 } }],
          true,
        ),
      ).rejects.toThrow(/beyond image width/);

      // Region extends beyond image height
      await expect(
        service.cropRegions(
          testImage,
          [{ position: { x: 0, y: 150 }, size: { w: 50, h: 100 } }],
          true,
        ),
      ).rejects.toThrow(/beyond image height/);

      // Negative position
      await expect(
        service.cropRegions(
          testImage,
          [{ position: { x: -10, y: 0 }, size: { w: 50, h: 50 } }],
          true,
        ),
      ).rejects.toThrow(/cannot be negative/);

      // Zero size
      await expect(
        service.cropRegions(
          testImage,
          [{ position: { x: 0, y: 0 }, size: { w: 0, h: 50 } }],
          true,
        ),
      ).rejects.toThrow(/must be positive/);
    });

    it('should include correct metadata', async () => {
      const testImage = await sharp({
        create: {
          width: 300,
          height: 250,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const regions = [
        { position: { x: 10, y: 20 }, size: { w: 80, h: 90 } },
        { position: { x: 150, y: 100 }, size: { w: 120, h: 130 } },
      ];

      const result = await service.cropRegions(testImage, regions, true);

      expect(result.metadata.originalDimensions).toEqual({
        width: 300,
        height: 250,
      });
      expect(result.metadata.croppedRegions).toHaveLength(2);
      expect(result.metadata.croppedRegions[0]).toEqual({
        index: 0,
        position: { x: 10, y: 20 },
        size: { width: 80, height: 90 },
      });
      expect(result.metadata.croppedRegions[1]).toEqual({
        index: 1,
        position: { x: 150, y: 100 },
        size: { width: 120, height: 130 },
      });
    });

    it('should handle invalid image buffer', async () => {
      const invalidBuffer = Buffer.from('not an image');

      await expect(
        service.cropRegions(
          invalidBuffer,
          [{ position: { x: 0, y: 0 }, size: { w: 50, h: 50 } }],
          true,
        ),
      ).rejects.toThrow();
    });
  });
});
