import { Test, TestingModule } from '@nestjs/testing';
import { ReplicateService } from './replicate.service';
import { AppConfigService } from '../../../config/app-config.service';

describe('ReplicateService', () => {
  let service: ReplicateService;
  let configService: AppConfigService;

  const mockConfigService = {
    replicateApiToken: 'test_token_12345',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplicateService,
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ReplicateService>(ReplicateService);
    configService = module.get<AppConfigService>(AppConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('convertBufferToDataUrl', () => {
    it('should convert buffer to data URL', () => {
      const buffer = Buffer.from('test data');
      const mimeType = 'image/png';

      const result = service.convertBufferToDataUrl(buffer, mimeType);

      expect(result).toMatch(/^data:image\/png;base64,/);
      expect(result).toContain(buffer.toString('base64'));
    });

    it('should handle different MIME types', () => {
      const buffer = Buffer.from('jpeg data');
      const mimeType = 'image/jpeg';

      const result = service.convertBufferToDataUrl(buffer, mimeType);

      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  describe('downloadMask', () => {
    it('should download mask from URL', async () => {
      const mockUrl = 'https://example.com/mask.png';
      const mockBuffer = Buffer.from('mask data');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockBuffer.buffer,
      });

      const result = await service.downloadMask(mockUrl);

      expect(global.fetch).toHaveBeenCalledWith(mockUrl);
      expect(result).toEqual(mockBuffer);
    });

    it('should throw error on failed download', async () => {
      const mockUrl = 'https://example.com/mask.png';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.downloadMask(mockUrl)).rejects.toThrow('Mask download failed');
    });
  });

  describe('API token configuration', () => {
    it('should throw error if API token is not configured', () => {
      const invalidConfigService = {
        get replicateApiToken() {
          throw new Error('REPLICATE_API_TOKEN is not configured');
        },
      };

      expect(() => {
        new ReplicateService(invalidConfigService as any);
      }).toThrow('REPLICATE_API_TOKEN is not configured');
    });
  });
});
