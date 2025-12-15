import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { ImageProcessingService } from './services/image-processing/image-processing.service';
import { ColorParserService } from './services/color-parser/color-parser.service';
import { GeminiService } from './services/gemini/gemini.service';
import { BoundingBoxTransformService } from './services/bounding-box-transform/bounding-box-transform.service';

@Module({
  controllers: [ImageController],
  providers: [
    ImageProcessingService,
    ColorParserService,
    GeminiService,
    BoundingBoxTransformService,
  ],
})
export class ImageModule {}
