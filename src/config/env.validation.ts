import {
  IsNumber,
  IsEnum,
  IsString,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsNumber()
  @Min(0)
  @Max(255)
  @IsOptional()
  TOLERANCE: number = 0;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  GOOGLE_GEMINI_API_KEY?: string;

  @IsString()
  @IsOptional()
  GEMINI_MODEL: string = 'gemini-3-pro-preview';

  @IsString()
  @IsOptional()
  GEMINI_IMAGE_MODEL: string = 'gemini-3-pro-image-preview';

  @IsNumber()
  @Min(1000)
  @Max(1200000)
  @IsOptional()
  GEMINI_API_TIMEOUT: number = 600000;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  REPLICATE_API_TOKEN?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
