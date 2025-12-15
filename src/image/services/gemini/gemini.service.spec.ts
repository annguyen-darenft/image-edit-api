import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';
import { AppConfigService } from '../../../config/app-config.service';

describe('GeminiService', () => {
  let service: GeminiService;
  let configService: AppConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        {
          provide: AppConfigService,
          useValue: {
            geminiApiKey: 'test-api-key',
            geminiModel: 'gemini-3-pro-preview',
            geminiTimeout: 30000,
          },
        },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
    configService = module.get<AppConfigService>(AppConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildDetectionPrompt', () => {
    it('should build Vietnamese prompt with object descriptions', () => {
      const objects = [
        { name: 'cậu bé', description: 'tóc đen, đi chân đất' },
        { name: 'bà cụ', description: 'tóc trắng, cầm thanh sắt' },
      ];

      // Access private method for testing
      const prompt = (service as any).buildDetectionPrompt(objects);

      expect(prompt).toContain('cậu bé');
      expect(prompt).toContain('bà cụ');
      expect(prompt).toContain('tóc đen, đi chân đất');
      expect(prompt).toContain('tóc trắng, cầm thanh sắt');
      expect(prompt).toContain('Hãy phân tích');
      expect(prompt).toContain('box_2d');
      expect(prompt).toContain('[0, 1000]');
    });

    it('should include all required Vietnamese instructions', () => {
      const objects = [{ name: 'test', description: 'test description' }];
      const prompt = (service as any).buildDetectionPrompt(objects);

      expect(prompt).toContain('Toàn bộ cơ thể của nhân vật');
      expect(prompt).toContain('Bóng đổ của nhân vật');
      expect(prompt).toContain('vật dụng mà nhân vật đang cầm');
    });
  });
});
