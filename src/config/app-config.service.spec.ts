import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('tolerance', () => {
    it('should return default tolerance when not set', () => {
      jest.spyOn(configService, 'get').mockReturnValue('0');
      expect(service.tolerance).toBe(0);
    });

    it('should parse tolerance from environment', () => {
      jest.spyOn(configService, 'get').mockReturnValue('25');
      expect(service.tolerance).toBe(25);
    });

    it('should parse string tolerance value', () => {
      jest.spyOn(configService, 'get').mockReturnValue('50');
      expect(service.tolerance).toBe(50);
    });

    it('should throw error for invalid tolerance (negative)', () => {
      jest.spyOn(configService, 'get').mockReturnValue('-10');
      expect(() => service.tolerance).toThrow(
        'Invalid TOLERANCE value: -10. Must be a number between 0-255',
      );
    });

    it('should throw error for invalid tolerance (too large)', () => {
      jest.spyOn(configService, 'get').mockReturnValue('300');
      expect(() => service.tolerance).toThrow(
        'Invalid TOLERANCE value: 300. Must be a number between 0-255',
      );
    });

    it('should throw error for non-numeric tolerance', () => {
      jest.spyOn(configService, 'get').mockReturnValue('abc');
      expect(() => service.tolerance).toThrow(
        'Invalid TOLERANCE value: abc. Must be a number between 0-255',
      );
    });

    it('should accept tolerance at boundary (0)', () => {
      jest.spyOn(configService, 'get').mockReturnValue('0');
      expect(service.tolerance).toBe(0);
    });

    it('should accept tolerance at boundary (255)', () => {
      jest.spyOn(configService, 'get').mockReturnValue('255');
      expect(service.tolerance).toBe(255);
    });
  });

  describe('port', () => {
    it('should return default port when not set', () => {
      jest.spyOn(configService, 'get').mockReturnValue('3000');
      expect(service.port).toBe(3000);
    });

    it('should parse port from environment', () => {
      jest.spyOn(configService, 'get').mockReturnValue('8080');
      expect(service.port).toBe(8080);
    });

    it('should throw error for invalid port (0)', () => {
      jest.spyOn(configService, 'get').mockReturnValue('0');
      expect(() => service.port).toThrow(
        'Invalid PORT value: 0. Must be between 1-65535',
      );
    });

    it('should throw error for invalid port (too large)', () => {
      jest.spyOn(configService, 'get').mockReturnValue('70000');
      expect(() => service.port).toThrow(
        'Invalid PORT value: 70000. Must be between 1-65535',
      );
    });

    it('should throw error for non-numeric port', () => {
      jest.spyOn(configService, 'get').mockReturnValue('abc');
      expect(() => service.port).toThrow(
        'Invalid PORT value: abc. Must be between 1-65535',
      );
    });
  });

  describe('nodeEnv', () => {
    it('should return default environment when not set', () => {
      jest.spyOn(configService, 'get').mockReturnValue('development');
      expect(service.nodeEnv).toBe('development');
    });

    it('should return environment from config', () => {
      jest.spyOn(configService, 'get').mockReturnValue('production');
      expect(service.nodeEnv).toBe('production');
    });

    it('should return test environment', () => {
      jest.spyOn(configService, 'get').mockReturnValue('test');
      expect(service.nodeEnv).toBe('test');
    });
  });
});
