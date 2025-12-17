import {
  Injectable,
  Logger,
  InternalServerErrorException,
  RequestTimeoutException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { AppConfigService } from '../../../config/app-config.service';
import type { ObjectDescriptionDto } from '../../dto/detect-bounding-boxes.dto';

export interface GeminiBoundingBox {
  label: string;
  type: 'object' | 'cover';
  box_2d: [number, number, number, number]; // [y_min, x_min, y_max, x_max]
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI;

  constructor(private readonly configService: AppConfigService) {
    this.client = new GoogleGenAI({
      apiKey: this.configService.geminiApiKey,
    });
  }

  /**
   * Detect bounding boxes using Gemini Vision API
   * @param imageBuffer Image file buffer
   * @param objects List of objects to detect with descriptions
   * @param imageMimeType MIME type of the image (e.g., 'image/jpeg')
   * @returns Array of detected bounding boxes with labels and coordinates
   */
  async detectBoundingBoxes(
    imageBuffer: Buffer,
    objects: ObjectDescriptionDto[],
    imageMimeType: string,
  ): Promise<GeminiBoundingBox[]> {
    const timeoutMs = this.configService.geminiTimeout;

    try {
      // Build Vietnamese detection prompt
      const prompt = this.buildDetectionPrompt(objects);
      this.logger.debug('prompt: ', prompt);

      // Convert buffer to base64
      const imageBase64 = imageBuffer.toString('base64');

      this.logger.log(
        `Calling Gemini API with model: ${this.configService.geminiModel}, timeout: ${timeoutMs}ms`,
      );

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new RequestTimeoutException(
                `Gemini API request timed out after ${timeoutMs}ms`,
              ),
            ),
          timeoutMs,
        );
      });

      // Create API call promise
      const apiPromise = this.client.models.generateContent({
        model: this.configService.geminiModel,
        contents: [
          prompt,
          {
            inlineData: {
              mimeType: imageMimeType,
              data: imageBase64,
            },
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Low temperature for consistent detection
        },
      });

      // Race between API call and timeout
      const response = await Promise.race([apiPromise, timeoutPromise]);
      this.logger.debug(response);

      // Parse response
      const responseText = response.text || '[]';
      const boundingBoxes: GeminiBoundingBox[] = JSON.parse(responseText);

      // Validate response structure
      this.validateBoundingBoxesResponse(boundingBoxes);

      this.logger.log(`Detected ${boundingBoxes.length} objects`);
      return boundingBoxes;
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof RequestTimeoutException) {
        this.logger.error(`Gemini API timeout after ${timeoutMs}ms`);
        throw error;
      }

      this.logger.error('Gemini API error', error);
      throw new InternalServerErrorException(
        'Failed to detect bounding boxes: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }

  /**
   * Build Vietnamese detection prompt with object descriptions
   * @param objects List of objects to detect
   * @returns Formatted Vietnamese prompt for Gemini
   */
  private buildDetectionPrompt(objects: ObjectDescriptionDto[]): string {
    const objectDescriptions = objects
      .map(
        (obj, index) =>
          `- ${index + 1}: ${obj.name}. Mô tả: ${obj.description}.`,
      )
      .join('\n');

    return `Hãy phân tích tệp hình ảnh gốc. 
Nhiệm vụ 1: xác định khung hình chữ nhật bao quanh (bounding box) cho các đối tượng chính:

${objectDescriptions}

Yêu cầu về bounding box: phải bao bọc 'khít' nhất có thể, nhưng phải chứa toàn bộ các yếu tố sau:
- Toàn bộ cơ thể của nhân vật.
- Bóng đổ của nhân vật đó trên mặt đất.
- Các đối tượng vừa chắn lên nhân vật nhưng cũng vừa bị một phần nhân vật che lên (ví dụ đang ôm quả bóng, tay phải che lên quả bóng nhưng bóng che lên tay trái)

Nhiệm vụ 2: xác định bounding box của các vật thể tiền cảnh đang chắn lên bất kì bộ phận nào của các nhân vật trên. 
Yêu cầu: bounding box phải chứa toàn bộ ảnh của vật thể tiền cảnh đó.

YÊU CẦU TỐI QUAN TRỌNG: Trả về kết quả là một mảng JSON theo cấu trúc sau:
[
  {
    "label": "Tên object đó (nếu object là đối tượng chính) hoặc tên của vật thể tiền cảnh",
    "type": "'object' nếu đó là đối tượng, 'cover' nếu là vật thể tiền cảnh",
    "box_2d": [y_min, x_min, y_max, x_max],
  }
]

Lưu ý:
- Tọa độ box_2d phải là số nguyên trong khoảng [0, 1000] (normalized coordinates).`;
  }

  /**
   * Validate Gemini API response structure
   * @param boundingBoxes Response from Gemini API
   * @throws InternalServerErrorException if response is invalid
   */
  private validateBoundingBoxesResponse(
    boundingBoxes: any,
  ): asserts boundingBoxes is GeminiBoundingBox[] {
    // Validate that response is an array
    if (!Array.isArray(boundingBoxes)) {
      throw new InternalServerErrorException(
        'Invalid Gemini response: expected array of bounding boxes',
      );
    }

    // Validate each bounding box structure
    boundingBoxes.forEach((box, index) => {
      // Validate label
      if (!box.label || typeof box.label !== 'string') {
        throw new InternalServerErrorException(
          `Invalid bounding box ${index}: missing or invalid label`,
        );
      }

      // Validate box_2d is array of 4 numbers
      if (!Array.isArray(box.box_2d) || box.box_2d.length !== 4) {
        throw new InternalServerErrorException(
          `Invalid bounding box ${index}: box_2d must be array of 4 numbers`,
        );
      }

      // Validate each coordinate is a number in valid range [0, 1000]
      if (
        !box.box_2d.every(
          (coord: any) =>
            typeof coord === 'number' && coord >= 0 && coord <= 1000,
        )
      ) {
        throw new InternalServerErrorException(
          `Invalid bounding box ${index}: coordinates must be numbers in range [0, 1000]`,
        );
      }
    });
  }

  /**
   * Calculate nearest aspect ratio from supported options
   * @param width Image width
   * @param height Image height
   * @returns Nearest supported aspect ratio
   */
  private calculateNearestAspectRatio(width: number, height: number): string {
    const supportedRatios = [
      { ratio: '1:1', value: 1 / 1 },
      { ratio: '2:3', value: 2 / 3 },
      { ratio: '3:2', value: 3 / 2 },
      { ratio: '3:4', value: 3 / 4 },
      { ratio: '4:3', value: 4 / 3 },
      { ratio: '9:16', value: 9 / 16 },
      { ratio: '16:9', value: 16 / 9 },
      { ratio: '21:9', value: 21 / 9 },
    ];

    const inputRatio = width / height;

    // Find closest ratio
    let nearest = supportedRatios[0];
    let minDiff = Math.abs(inputRatio - nearest.value);

    for (const option of supportedRatios) {
      const diff = Math.abs(inputRatio - option.value);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = option;
      }
    }

    return nearest.ratio;
  }

  /**
   * Calculate nearest image size from supported options
   * @param width Image width
   * @param height Image height
   * @returns Nearest supported image size
   */
  private calculateNearestImageSize(width: number, height: number): string {
    const maxDimension = Math.max(width, height);

    // 1K = ~1024, 2K = ~2048, 4K = ~4096
    if (maxDimension <= 1536) {
      return '1K';
    } else if (maxDimension <= 3072) {
      return '2K';
    } else {
      return '4K';
    }
  }

  /**
   * Crop and isolate object using Gemini image generation
   * @param imageBuffer Input image buffer
   * @param objectName Name of object to isolate
   * @param objectDescription Optional object description
   * @param imageMimeType MIME type of input image
   * @returns PNG buffer with isolated object
   */
  async cropObjectWithGemini(
    imageBuffer: Buffer,
    objectName: string,
    objectDescription: string | undefined,
    imageMimeType: string,
  ): Promise<Buffer> {
    const timeoutMs = this.configService.geminiTimeout;

    try {
      // Extract image dimensions
      const metadata = await sharp(imageBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Failed to extract image dimensions');
      }

      // Calculate image config for Gemini
      const aspectRatio = this.calculateNearestAspectRatio(
        metadata.width,
        metadata.height,
      );
      const imageSize = this.calculateNearestImageSize(
        metadata.width,
        metadata.height,
      );

      this.logger.log(
        `Image config: ${metadata.width}x${metadata.height} → ` +
          `aspectRatio=${aspectRatio}, imageSize=${imageSize}`,
      );

      // Build Vietnamese prompt
      const objectText = objectDescription
        ? `${objectName} ${objectDescription}`
        : objectName;

      const prompt = `Input: Tập trung vào đối tượng chính: "${objectText}".
Mục đích: Tách lớp riêng ảnh nhân vật này ra, loại bỏ các vật không thuộc về nhân vật và khôi phục những phần cơ thể bị che khuất trong ảnh gốc. Set background về một trong các mã màu sau: #00FF00, #0000FF, #FF00FF, miễn là không trùng màu với bất kì màu nào trong ảnh nhân vật.
Output: Kết quả là ảnh đối tượng chính hoàn chỉnh và không bị lẫn các vật thể khác. Kích cỡ ảnh output giống 100% với ảnh input.`;

      this.logger.debug('prompt: ', prompt);

      // Convert to base64
      const imageBase64 = imageBuffer.toString('base64');

      // Get image generation model
      const model = this.configService.geminiImageModel;

      this.logger.log(
        `Calling Gemini image generation with model: ${model}, timeout: ${timeoutMs}ms`,
      );

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new RequestTimeoutException(
                `Gemini API timeout after ${timeoutMs}ms`,
              ),
            ),
          timeoutMs,
        );
      });

      // Call Gemini image generation API
      const apiPromise = this.client.models.generateContent({
        model,
        contents: [
          prompt,
          {
            inlineData: {
              mimeType: imageMimeType,
              data: imageBase64,
            },
          },
        ],
        config: {
          temperature: 0.7, // Allow some creativity
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);

      // Extract image from response
      // Response format varies - could be base64 or binary
      let imageData: Buffer;

      if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        // Base64 response
        const base64Data =
          response.candidates[0].content.parts[0].inlineData.data;
        if (typeof base64Data !== 'string' || base64Data.length === 0) {
          throw new Error('Invalid base64 data format from Gemini');
        }
        imageData = Buffer.from(base64Data, 'base64');
      } else if (response.text && typeof response.text === 'string') {
        // Text response might be base64
        const cleanBase64 = response.text.replace(
          /^data:image\/\w+;base64,/,
          '',
        );
        if (!cleanBase64 || cleanBase64.length === 0) {
          throw new Error('Empty or invalid base64 text response from Gemini');
        }
        imageData = Buffer.from(cleanBase64, 'base64');
      } else {
        this.logger.error(
          'Unexpected Gemini response structure:',
          JSON.stringify(response, null, 2),
        );
        throw new Error(
          'Invalid response format from Gemini - no image data found',
        );
      }

      // Validate buffer is not empty
      if (!imageData || imageData.length === 0) {
        throw new Error('Received empty image data from Gemini');
      }

      // Convert to PNG using Sharp
      const pngBuffer = await sharp(imageData).png().toBuffer();

      // Validate dimensions (log warning only, don't resize to preserve quality)
      const outputMeta = await sharp(pngBuffer).metadata();

      if (
        metadata.width !== outputMeta.width ||
        metadata.height !== outputMeta.height
      ) {
        this.logger.warn(
          `Dimension mismatch: input ${metadata.width}x${metadata.height}, ` +
            `output ${outputMeta.width}x${outputMeta.height}. ` +
            `Gemini may have adjusted based on aspectRatio=${aspectRatio}, imageSize=${imageSize}`,
        );
      }

      this.logger.log(
        `Successfully generated cropped object image ` +
          `(${outputMeta.width}x${outputMeta.height})`,
      );
      return pngBuffer;
    } catch (error) {
      if (error instanceof RequestTimeoutException) {
        this.logger.error(`Gemini API timeout after ${timeoutMs}ms`);
        throw error;
      }

      this.logger.error('Gemini image generation error', error);
      throw new InternalServerErrorException(
        'Failed to crop object: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }
}
