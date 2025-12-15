import { Test, TestingModule } from '@nestjs/testing';
import { ImageController } from './image.controller';
import { ColorParserService } from './services/color-parser/color-parser.service';
import { ImageProcessingService } from './services/image-processing/image-processing.service';
import { GeminiService } from './services/gemini/gemini.service';
import { BoundingBoxTransformService } from './services/bounding-box-transform/bounding-box-transform.service';
import { AppConfigService } from '../config/app-config.service';

describe('ImageController', () => {
  let controller: ImageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageController],
      providers: [
        ColorParserService,
        ImageProcessingService,
        GeminiService,
        BoundingBoxTransformService,
        {
          provide: AppConfigService,
          useValue: {
            tolerance: 0,
            port: 3000,
            nodeEnv: 'test',
            geminiApiKey: 'test-api-key',
            geminiModel: 'gemini-3-pro-preview',
            geminiTimeout: 30000,
          },
        },
      ],
    }).compile();

    controller = module.get<ImageController>(ImageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
