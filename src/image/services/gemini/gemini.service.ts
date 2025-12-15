import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AppConfigService } from '../../../config/app-config.service';
import type { ObjectDescriptionDto } from '../../dto/detect-bounding-boxes.dto';

export interface GeminiBoundingBox {
  label: string;
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
    try {
      // Build Vietnamese detection prompt
      const prompt = this.buildDetectionPrompt(objects);

      // Convert buffer to base64
      const imageBase64 = imageBuffer.toString('base64');

      this.logger.log(
        `Calling Gemini API with model: ${this.configService.geminiModel}`,
      );

      // Call Gemini API
      const response = await this.client.models.generateContent({
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

      // Parse response
      const responseText = response.text || '[]';
      this.logger.debug(`Gemini response: ${responseText}`);

      const boundingBoxes: GeminiBoundingBox[] = JSON.parse(responseText);

      this.logger.log(`Detected ${boundingBoxes.length} objects`);
      return boundingBoxes;
    } catch (error) {
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
          `- Object ${index + 1}: ${obj.name}. Mô tả: ${obj.description}.`,
      )
      .join('\n');

    return `Hãy phân tích tệp hình ảnh gốc. Nhiệm vụ của bạn là xác định khung hình chữ nhật bao quanh (bounding box) cho các đối tượng chính:

${objectDescriptions}

Yêu cầu về khung bao quanh: Mỗi khung hình chữ nhật phải bao bọc 'khít' nhất có thể, nhưng phải chứa toàn bộ các yếu tố sau:
- Toàn bộ cơ thể của nhân vật.
- Bóng đổ của nhân vật đó trên mặt đất.
- Tất cả các vật dụng mà nhân vật đang cầm nắm hoặc tương tác trực tiếp.

YÊU CẦU TỐI QUAN TRỌNG: Trả về kết quả là một mảng JSON theo cấu trúc sau:
[
  {
    "label": "Tên object đó (ví dụ '${objects[0]?.name || 'cậu bé'}')",
    "box_2d": [y_min, x_min, y_max, x_max]
  }
]

Lưu ý: 
- Các bounding box cố gắng tránh bị đè lên nhau
- Tọa độ box_2d phải là số nguyên trong khoảng [0, 1000] (normalized coordinates).`;
  }
}
