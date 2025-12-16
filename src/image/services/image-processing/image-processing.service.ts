import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import sharp from 'sharp';
import { RGBColor } from '../color-parser/color-parser.service';
import { IMAGE_CONSTANTS } from '../../image.constants';

interface ProcessingOptions {
  backgroundColor: RGBColor;
  tolerance?: number; // Euclidean distance threshold for color matching
}

export interface CropRegion {
  object?: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
}

export interface CropResult {
  croppedImages: Buffer[];
  backgroundImage: Buffer | null;
  metadata: {
    originalDimensions: { width: number; height: number };
    croppedRegions: Array<{
      object?: string;
      index: number;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }>;
  };
}

/**
 * Convert buffer to base64 data URL
 */
export function bufferToDataUrl(buffer: Buffer, mimeType: string = 'image/png'): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

interface RawPixelData {
  data: Buffer;
  info: {
    width: number;
    height: number;
    channels: number;
  };
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  /**
   * Remove background from image by replacing matching pixels with transparency
   */
  async removeBackground(
    imageBuffer: Buffer,
    options: ProcessingOptions,
  ): Promise<Buffer> {
    try {
      this.logger.log('Starting background removal process');
      const startTime = Date.now();

      // Step 1: Extract raw RGBA pixel data
      const { data, info } = await this.extractRawPixels(imageBuffer);
      this.logger.log(
        `Extracted ${info.width}x${info.height} pixels (${info.channels} channels)`,
      );

      // Step 2: Remove matching color pixels
      const modifiedData = this.removeColorPixels(
        data,
        options.backgroundColor,
        options.tolerance || 0,
      );

      // Step 3: Rebuild PNG from raw data
      const outputBuffer = await this.buildPngFromRaw(
        modifiedData,
        info.width,
        info.height,
      );

      const duration = Date.now() - startTime;
      this.logger.log(`Background removal completed in ${duration}ms`);

      return outputBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'Background removal failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to process image: ' + errorMessage,
      );
    }
  }

  /**
   * Extract raw RGBA pixel data from image buffer
   */
  private async extractRawPixels(imageBuffer: Buffer): Promise<RawPixelData> {
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha() // Add alpha channel if missing
      .raw()
      .toBuffer({ resolveWithObject: true });

    return { data, info };
  }

  /**
   * Remove pixels matching target color (set alpha to 0)
   * @param tolerance - Color matching tolerance (0 = exact match)
   */
  private removeColorPixels(
    pixelData: Buffer,
    targetColor: RGBColor,
    tolerance: number = 0,
  ): Buffer {
    let modifiedCount = 0;

    // Loop through pixels (RGBA = 4 bytes per pixel)
    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      // pixelData[i + 3] = alpha channel

      // Color matching
      const isMatch = this.isColorMatch({ r, g, b }, targetColor, tolerance);

      if (isMatch) {
        pixelData[i + 3] = 0; // Set alpha to fully transparent
        modifiedCount++;
      }
    }

    const totalPixels = pixelData.length / 4;
    const percentage = ((modifiedCount / totalPixels) * 100).toFixed(2);
    this.logger.log(
      `Removed ${modifiedCount}/${totalPixels} pixels (${percentage}%)`,
    );

    return pixelData;
  }

  /**
   * Check if pixel color matches target color
   * @param tolerance - 0 = exact match, >0 = Euclidean distance threshold
   */
  private isColorMatch(
    pixelColor: RGBColor,
    targetColor: RGBColor,
    tolerance: number,
  ): boolean {
    if (tolerance === 0) {
      // Exact match
      return (
        pixelColor.r === targetColor.r &&
        pixelColor.g === targetColor.g &&
        pixelColor.b === targetColor.b
      );
    }

    // Euclidean distance matching
    const distance = Math.sqrt(
      Math.pow(pixelColor.r - targetColor.r, 2) +
        Math.pow(pixelColor.g - targetColor.g, 2) +
        Math.pow(pixelColor.b - targetColor.b, 2),
    );

    return distance <= tolerance;
  }

  /**
   * Build PNG from modified raw RGBA data
   */
  private async buildPngFromRaw(
    rawData: Buffer,
    width: number,
    height: number,
  ): Promise<Buffer> {
    return sharp(rawData, {
      raw: {
        width,
        height,
        channels: 4, // RGBA
      },
    })
      .png({
        compressionLevel: IMAGE_CONSTANTS.PNG_COMPRESSION_LEVEL,
        quality: IMAGE_CONSTANTS.PNG_QUALITY,
      })
      .toBuffer();
  }

  /**
   * Crop multiple regions from image and optionally generate background
   */
  async cropRegions(
    imageBuffer: Buffer,
    regions: CropRegion[],
    includeBackground: boolean = true,
  ): Promise<CropResult> {
    try {
      this.logger.log(`Starting crop operation for ${regions.length} regions`);
      const startTime = Date.now();

      // Get image metadata to validate regions
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;

      if (!width || !height) {
        throw new Error('Unable to determine image dimensions');
      }

      // Validate all regions against image dimensions
      this.validateCropRegions(regions, width, height);

      // Crop all regions in parallel using separate Sharp instances
      const croppedImages = await Promise.all(
        regions.map((region, index) =>
          this.extractCropRegion(imageBuffer, region, index),
        ),
      );

      // Generate background image with transparent cropped regions
      let backgroundImage: Buffer | null = null;
      if (includeBackground) {
        backgroundImage = await this.generateBackgroundWithTransparency(
          imageBuffer,
          regions,
          width,
          height,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Crop operation completed in ${duration}ms`);

      return {
        croppedImages,
        backgroundImage,
        metadata: {
          originalDimensions: { width, height },
          croppedRegions: regions.map((region, index) => ({
            index,
            object: region.object,
            position: region.position,
            size: { width: region.size.w, height: region.size.h },
          })),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'Crop operation failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to crop image: ' + errorMessage,
      );
    }
  }

  /**
   * Validate crop regions against image dimensions
   */
  private validateCropRegions(
    regions: CropRegion[],
    imageWidth: number,
    imageHeight: number,
  ): void {
    regions.forEach((region, index) => {
      const { x, y } = region.position;
      const { w, h } = region.size;

      if (x < 0 || y < 0) {
        throw new Error(
          `Region ${index}: Position cannot be negative (x: ${x}, y: ${y})`,
        );
      }

      if (w <= 0 || h <= 0) {
        throw new Error(
          `Region ${index}: Size must be positive (w: ${w}, h: ${h})`,
        );
      }

      if (x + w > imageWidth) {
        throw new Error(
          `Region ${index}: Crop extends beyond image width (x: ${x}, w: ${w}, image width: ${imageWidth})`,
        );
      }

      if (y + h > imageHeight) {
        throw new Error(
          `Region ${index}: Crop extends beyond image height (y: ${y}, h: ${h}, image height: ${imageHeight})`,
        );
      }
    });
  }

  /**
   * Extract single crop region from image
   */
  private async extractCropRegion(
    imageBuffer: Buffer,
    region: CropRegion,
    index: number,
  ): Promise<Buffer> {
    this.logger.log(
      `Extracting region ${index}: (${region.position.x}, ${region.position.y}) ${region.size.w}x${region.size.h}`,
    );

    return sharp(imageBuffer)
      .extract({
        left: region.position.x,
        top: region.position.y,
        width: region.size.w,
        height: region.size.h,
      })
      .png({
        compressionLevel: IMAGE_CONSTANTS.PNG_COMPRESSION_LEVEL,
        quality: IMAGE_CONSTANTS.PNG_QUALITY,
      })
      .toBuffer();
  }

  /**
   * Generate background image with cropped regions marked as transparent
   */
  private async generateBackgroundWithTransparency(
    imageBuffer: Buffer,
    regions: CropRegion[],
    width: number,
    height: number,
  ): Promise<Buffer> {
    this.logger.log('Generating background image with transparent regions');

    // Extract raw RGBA pixel data
    const { data, info } = await this.extractRawPixels(imageBuffer);

    // Mark pixels in crop regions as transparent
    for (const region of regions) {
      const { x, y } = region.position;
      const { w, h } = region.size;

      // Iterate through pixels in this region
      for (let row = y; row < y + h && row < height; row++) {
        for (let col = x; col < x + w && col < width; col++) {
          const pixelIndex = (row * width + col) * 4;
          data[pixelIndex + 3] = 0; // Set alpha to transparent
        }
      }
    }

    // Build PNG from modified pixel data
    return this.buildPngFromRaw(data, info.width, info.height);
  }

  /**
   * Extract image metadata (dimensions)
   */
  async extractImageMetadata(
    imageBuffer: Buffer,
  ): Promise<{ width: number; height: number }> {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }
}
