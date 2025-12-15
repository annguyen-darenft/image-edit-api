import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { BoundingBoxDto } from '../../dto/bounding-box-response.dto';
import type {
  ObjectDescriptionDto,
  ImageSizeDto,
} from '../../dto/detect-bounding-boxes.dto';
import type { GeminiBoundingBox } from '../gemini/gemini.service';

@Injectable()
export class BoundingBoxTransformService {
  private readonly logger = new Logger(BoundingBoxTransformService.name);

  /**
   * Transform Gemini bounding boxes to API response format
   * Converts normalized coordinates [0-1000] to absolute pixels
   * Converts format from [y_min, x_min, y_max, x_max] to {position: {x, y}, size: {w, h}}
   *
   * @param geminiBoundingBoxes Raw bounding boxes from Gemini API
   * @param objectDescriptions Original object descriptions for name matching
   * @param imageSize Original image dimensions for coordinate conversion
   * @returns Transformed bounding boxes in API response format
   */
  transform(
    geminiBoundingBoxes: GeminiBoundingBox[],
    objectDescriptions: ObjectDescriptionDto[],
    imageSize: ImageSizeDto,
  ): BoundingBoxDto[] {
    return geminiBoundingBoxes.map((geminiBox) => {
      // Find matching object description
      const matchedObject = this.findMatchingObject(
        geminiBox.label,
        objectDescriptions,
      );

      // Convert coordinates from Gemini format [y_min, x_min, y_max, x_max]
      const [yMin, xMin, yMax, xMax] = geminiBox.box_2d;

      // Normalize from [0, 1000] to absolute pixels
      const x = Math.round((xMin / 1000) * imageSize.width);
      const y = Math.round((yMin / 1000) * imageSize.height);
      const w = Math.round(((xMax - xMin) / 1000) * imageSize.width);
      const h = Math.round(((yMax - yMin) / 1000) * imageSize.height);

      // Validate bounds
      this.validateBounds(x, y, w, h, imageSize);

      this.logger.debug(
        `Transformed ${geminiBox.label}: [${yMin}, ${xMin}, ${yMax}, ${xMax}] → {x: ${x}, y: ${y}, w: ${w}, h: ${h}}`,
      );

      return {
        object: matchedObject,
        position: { x, y },
        size: { w, h },
      };
    });
  }

  /**
   * Find matching object name from descriptions
   * Tries exact match first, then partial match, finally falls back to Gemini label
   *
   * @param geminiLabel Label returned by Gemini
   * @param objectDescriptions Original object descriptions
   * @returns Matched object name
   */
  private findMatchingObject(
    geminiLabel: string,
    objectDescriptions: ObjectDescriptionDto[],
  ): string {
    // Try exact match first
    const exactMatch = objectDescriptions.find(
      (obj) => obj.name.toLowerCase() === geminiLabel.toLowerCase(),
    );
    if (exactMatch) {
      this.logger.debug(`Exact match found: ${geminiLabel} → ${exactMatch.name}`);
      return exactMatch.name;
    }

    // Try partial match (Gemini may translate or paraphrase)
    const partialMatch = objectDescriptions.find(
      (obj) =>
        geminiLabel.toLowerCase().includes(obj.name.toLowerCase()) ||
        obj.name.toLowerCase().includes(geminiLabel.toLowerCase()),
    );
    if (partialMatch) {
      this.logger.debug(
        `Partial match found: ${geminiLabel} → ${partialMatch.name}`,
      );
      return partialMatch.name;
    }

    // Fallback to Gemini label
    this.logger.warn(`No match found for label: ${geminiLabel}, using as-is`);
    return geminiLabel;
  }

  /**
   * Validate bounding box is within image bounds
   *
   * @param x X coordinate (left edge)
   * @param y Y coordinate (top edge)
   * @param w Width in pixels
   * @param h Height in pixels
   * @param imageSize Image dimensions
   * @throws BadRequestException if bounding box is invalid or out of bounds
   */
  private validateBounds(
    x: number,
    y: number,
    w: number,
    h: number,
    imageSize: ImageSizeDto,
  ): void {
    if (x < 0 || y < 0) {
      throw new BadRequestException(
        `Bounding box position cannot be negative (x: ${x}, y: ${y})`,
      );
    }

    if (x + w > imageSize.width || y + h > imageSize.height) {
      throw new BadRequestException(
        `Bounding box exceeds image bounds (${imageSize.width}x${imageSize.height}): ` +
          `position (${x}, ${y}) + size (${w}, ${h}) = (${x + w}, ${y + h})`,
      );
    }

    if (w <= 0 || h <= 0) {
      throw new BadRequestException(
        `Bounding box size must be positive (w: ${w}, h: ${h})`,
      );
    }
  }
}
