import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { ImageProcessingService } from './services/image-processing/image-processing.service';
import { ColorParserService } from './services/color-parser/color-parser.service';

@Module({
  controllers: [ImageController],
  providers: [ImageProcessingService, ColorParserService],
})
export class ImageModule {}
