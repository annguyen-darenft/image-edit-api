import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Get the default tolerance for color matching
   * @returns Euclidean distance threshold (0 = exact match, higher = more variation)
   * @throws Error if tolerance is invalid
   */
  get tolerance(): number {
    const value = this.configService.get('TOLERANCE', '0');
    const parsed = parseInt(value as string, 10);

    if (isNaN(parsed) || parsed < 0 || parsed > 255) {
      throw new Error(
        `Invalid TOLERANCE value: ${value}. Must be a number between 0-255`,
      );
    }

    return parsed;
  }

  /**
   * Get the server port
   * @throws Error if port is invalid
   */
  get port(): number {
    const value = this.configService.get('PORT', '3000');
    const parsed = parseInt(value as string, 10);

    if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error(`Invalid PORT value: ${value}. Must be between 1-65535`);
    }

    return parsed;
  }

  /**
   * Get the node environment
   */
  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  /**
   * Get Gemini API key
   * @throws Error if API key is not configured
   */
  get geminiApiKey(): string {
    const value = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');

    if (!value) {
      throw new Error(
        'GOOGLE_GEMINI_API_KEY is not configured. Get your API key from https://aistudio.google.com/apikey',
      );
    }

    return value;
  }

  /**
   * Get Gemini model name
   */
  get geminiModel(): string {
    return this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-3-pro-preview',
    );
  }

  /**
   * Get Gemini image generation model name
   */
  get geminiImageModel(): string {
    return this.configService.get<string>(
      'GEMINI_IMAGE_MODEL',
      'gemini-3-pro-image-preview',
    );
  }

  /**
   * Get Gemini API timeout in milliseconds
   */
  get geminiTimeout(): number {
    const value = this.configService.get('GEMINI_API_TIMEOUT', '600000');
    const parsed = parseInt(value as string, 10);

    if (isNaN(parsed) || parsed < 1000 || parsed > 600000) {
      throw new Error(
        `Invalid GEMINI_API_TIMEOUT value: ${value}. Must be between 1000-600000ms`,
      );
    }

    return parsed;
  }

  /**
   * Get Replicate API token
   * @throws Error if API token is not configured
   */
  get replicateApiToken(): string {
    const value = this.configService.get<string>('REPLICATE_API_TOKEN');

    if (!value) {
      throw new Error(
        'REPLICATE_API_TOKEN is not configured. Get your API token from https://replicate.com/account/api-tokens',
      );
    }

    return value;
  }
}
