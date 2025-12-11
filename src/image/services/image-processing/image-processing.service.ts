import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import sharp from 'sharp';
import { RGBColor } from '../color-parser/color-parser.service';

interface ProcessingOptions {
  backgroundColor: RGBColor;
  tolerance?: number; // Euclidean distance threshold for color matching
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
        compressionLevel: 9, // Maximum compression
        quality: 100,
      })
      .toBuffer();
  }
}
