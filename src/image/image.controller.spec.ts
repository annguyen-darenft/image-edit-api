import { Test, TestingModule } from '@nestjs/testing';
import { ImageController } from './image.controller';
import { ColorParserService } from './services/color-parser/color-parser.service';
import { ImageProcessingService } from './services/image-processing/image-processing.service';
import { AppConfigService } from '../config/app-config.service';

describe('ImageController', () => {
  let controller: ImageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageController],
      providers: [
        ColorParserService,
        ImageProcessingService,
        {
          provide: AppConfigService,
          useValue: {
            tolerance: 0,
            port: 3000,
            nodeEnv: 'test',
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
