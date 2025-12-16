import { Injectable, Logger } from '@nestjs/common';
import Replicate from 'replicate';
import { AppConfigService } from '../../../config/app-config.service';

export interface Sam2Input {
  image: string;
  points_per_side?: number;
  pred_iou_thresh?: number;
  stability_score_thresh?: number;
  use_m2m?: boolean;
}

export interface Sam2Output {
  combined_mask: string;
  individual_masks: string[];
}

@Injectable()
export class ReplicateService {
  private readonly logger = new Logger(ReplicateService.name);
  private readonly client: Replicate;
  private readonly maxRetries = 3;
  private readonly initialBackoff = 1000;

  constructor(private readonly configService: AppConfigService) {
    const apiToken = this.configService.replicateApiToken;
    this.client = new Replicate({
      auth: apiToken,
    });
  }

  /**
   * Run SAM 2 automatic segmentation on an image
   * @param input SAM 2 input parameters
   * @returns Combined mask and individual object masks
   */
  async runSam2Segmentation(input: Sam2Input): Promise<Sam2Output> {
    this.logger.log(
      `Starting SAM 2 automatic segmentation (points_per_side: ${input.points_per_side ?? 32})`,
    );

    try {
      const output = await this.runWithRetry(input);

      this.logger.log(
        `SAM 2 segmentation completed: 1 combined mask, ${output.individual_masks.length} individual masks`,
      );

      return output;
    } catch (error) {
      this.logger.error('SAM 2 segmentation failed', error);
      throw new Error(`Replicate API error: ${error.message}`);
    }
  }

  /**
   * Run prediction with exponential backoff retry
   */
  private async runWithRetry(input: Sam2Input): Promise<Sam2Output> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const output = await this.client.run(
          'meta/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83',
          {
            input: {
              image: input.image,
              points_per_side: input.points_per_side ?? 32,
              pred_iou_thresh: input.pred_iou_thresh ?? 0.88,
              stability_score_thresh: input.stability_score_thresh ?? 0.95,
              use_m2m: input.use_m2m ?? true,
            },
          },
        ) as any;

        // Validate output structure
        if (!output || typeof output !== 'object') {
          throw new Error('Invalid response from Replicate API: expected object');
        }

        const combinedMask = output.combined_mask;
        const individualMasks = output.individual_masks;

        // Validate combined_mask
        if (!combinedMask || typeof combinedMask !== 'string') {
          throw new Error('Invalid response: missing or invalid combined_mask');
        }

        // Validate individual_masks
        if (!Array.isArray(individualMasks)) {
          throw new Error('Invalid response: individual_masks must be an array');
        }

        // Validate all mask URLs
        individualMasks.forEach((mask, idx) => {
          if (typeof mask !== 'string' || !mask.startsWith('http')) {
            throw new Error(`Invalid mask URL at index ${idx}: ${mask}`);
          }
        });

        return {
          combined_mask: combinedMask,
          individual_masks: individualMasks,
        };
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries - 1) {
          const backoff = this.initialBackoff * Math.pow(2, attempt);
          this.logger.warn(
            `Attempt ${attempt + 1} failed, retrying in ${backoff}ms: ${error.message}`,
          );
          await this.sleep(backoff);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert image buffer to base64 data URL
   */
  convertBufferToDataUrl(buffer: Buffer, mimeType: string): string {
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Download mask from URL and return as buffer
   */
  async downloadMask(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download mask: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(`Failed to download mask from ${url}`, error);
      throw new Error(`Mask download failed: ${error.message}`);
    }
  }
}
