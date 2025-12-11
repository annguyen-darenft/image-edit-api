import { Test, TestingModule } from '@nestjs/testing';
import { ColorParserService } from './color-parser.service';
import { BadRequestException } from '@nestjs/common';

describe('ColorParserService', () => {
  let service: ColorParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ColorParserService],
    }).compile();

    service = module.get<ColorParserService>(ColorParserService);
  });

  describe('parseColor - Hex formats', () => {
    it('should parse 3-digit hex', () => {
      expect(service.parseColor('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(service.parseColor('#000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(service.parseColor('#F00')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should parse 6-digit hex', () => {
      expect(service.parseColor('#FFFFFF')).toEqual({
        r: 255,
        g: 255,
        b: 255,
      });
      expect(service.parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(service.parseColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle lowercase hex', () => {
      expect(service.parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(service.parseColor('#ffffff')).toEqual({
        r: 255,
        g: 255,
        b: 255,
      });
    });

    it('should throw on invalid hex', () => {
      expect(() => service.parseColor('#FF')).toThrow(BadRequestException);
      expect(() => service.parseColor('#FFFFF')).toThrow(BadRequestException);
    });
  });

  describe('parseColor - RGB formats', () => {
    it('should parse rgb with spaces', () => {
      expect(service.parseColor('rgb(255 255 255)')).toEqual({
        r: 255,
        g: 255,
        b: 255,
      });
      expect(service.parseColor('rgb(0 128 255)')).toEqual({
        r: 0,
        g: 128,
        b: 255,
      });
    });

    it('should parse rgb with commas', () => {
      expect(service.parseColor('rgb(255, 255, 255)')).toEqual({
        r: 255,
        g: 255,
        b: 255,
      });
      expect(service.parseColor('rgb(100,150,200)')).toEqual({
        r: 100,
        g: 150,
        b: 200,
      });
    });

    it('should parse rgba (ignore alpha)', () => {
      expect(service.parseColor('rgba(255, 255, 255, 1.0)')).toEqual({
        r: 255,
        g: 255,
        b: 255,
      });
      expect(service.parseColor('rgba(255,255,255,0.5)')).toEqual({
        r: 255,
        g: 255,
        b: 255,
      });
    });

    it('should throw on invalid rgb', () => {
      expect(() => service.parseColor('rgb(255, 255)')).toThrow(
        BadRequestException,
      );
      expect(() => service.parseColor('rgb(300, 255, 255)')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('parseColor - Named colors', () => {
    it('should parse named colors', () => {
      expect(service.parseColor('white')).toEqual({ r: 255, g: 255, b: 255 });
      expect(service.parseColor('black')).toEqual({ r: 0, g: 0, b: 0 });
      expect(service.parseColor('red')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle case insensitive', () => {
      expect(service.parseColor('WHITE')).toEqual({ r: 255, g: 255, b: 255 });
      expect(service.parseColor('Black')).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('isValidColor', () => {
    it('should return true for valid colors', () => {
      expect(service.isValidColor('#FFF')).toBe(true);
      expect(service.isValidColor('rgb(255, 255, 255)')).toBe(true);
      expect(service.isValidColor('white')).toBe(true);
    });

    it('should return false for invalid colors', () => {
      expect(service.isValidColor('invalid')).toBe(false);
      expect(service.isValidColor('#GGG')).toBe(false);
      expect(service.isValidColor('rgb(300, 255, 255)')).toBe(false);
    });
  });
});
