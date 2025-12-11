import { Injectable, BadRequestException } from '@nestjs/common';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

@Injectable()
export class ColorParserService {
  // Named color mapping
  private readonly namedColors: Record<string, RGBColor> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 255, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
  };

  /**
   * Parse color string to RGB object
   * Supports: #FFF, #FFFFFF, rgb(255 255 255), rgba(255,255,255,1.0), named colors
   */
  parseColor(colorString: string): RGBColor {
    const normalized = this.normalizeColorString(colorString);

    // Check named colors first
    if (this.namedColors[normalized]) {
      return this.namedColors[normalized];
    }

    // Try hex format
    if (normalized.startsWith('#')) {
      return this.parseHex(normalized);
    }

    // Try rgb/rgba format
    if (normalized.startsWith('rgb')) {
      return this.parseRgb(normalized);
    }

    throw new BadRequestException(
      `Invalid color format: "${colorString}". Supported: #FFF, #FFFFFF, rgb(R G B), rgba(R,G,B,A), white, black`,
    );
  }

  /**
   * Normalize color string (trim, lowercase)
   */
  private normalizeColorString(input: string): string {
    return input.trim().toLowerCase();
  }

  /**
   * Parse hex color (#FFF or #FFFFFF)
   */
  private parseHex(hex: string): RGBColor {
    const cleanHex = hex.replace('#', '');

    // 3-digit hex (#FFF)
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      return this.validateRGB({ r, g, b });
    }

    // 6-digit hex (#FFFFFF)
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return this.validateRGB({ r, g, b });
    }

    throw new BadRequestException(
      `Invalid hex color format: "${hex}". Use #FFF or #FFFFFF`,
    );
  }

  /**
   * Parse rgb() or rgba() format
   * Examples: rgb(255 255 255), rgb(255, 255, 255), rgba(255,255,255,1.0)
   */
  private parseRgb(rgbString: string): RGBColor {
    // Extract numbers from rgb()/rgba()
    const match = rgbString.match(/rgba?\(([^)]+)\)/);
    if (!match) {
      throw new BadRequestException(
        `Invalid RGB format: "${rgbString}". Use rgb(R G B) or rgba(R,G,B,A)`,
      );
    }

    // Split by comma or space
    const values = match[1]
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => parseFloat(v));

    if (values.length < 3) {
      throw new BadRequestException(
        `Invalid RGB values: "${rgbString}". Need at least 3 values (R,G,B)`,
      );
    }

    const r = Math.round(values[0]);
    const g = Math.round(values[1]);
    const b = Math.round(values[2]);

    return this.validateRGB({ r, g, b });
  }

  /**
   * Validate RGB values are in 0-255 range
   */
  private validateRGB(color: RGBColor): RGBColor {
    const { r, g, b } = color;

    if (
      isNaN(r) ||
      isNaN(g) ||
      isNaN(b) ||
      r < 0 ||
      r > 255 ||
      g < 0 ||
      g > 255 ||
      b < 0 ||
      b > 255
    ) {
      throw new BadRequestException(
        `Invalid RGB values: r=${r}, g=${g}, b=${b}. Must be 0-255`,
      );
    }

    return { r, g, b };
  }

  /**
   * Check if color string is valid
   */
  isValidColor(colorString: string): boolean {
    try {
      this.parseColor(colorString);
      return true;
    } catch {
      return false;
    }
  }
}
