import {
  Injectable,
  Logger,
  InternalServerErrorException,
  RequestTimeoutException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
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
}
