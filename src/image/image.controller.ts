import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ColorParserService } from './services/color-parser/color-parser.service';
import { ImageProcessingService } from './services/image-processing/image-processing.service';
import { RemoveBackgroundDto } from './dto/remove-background.dto';
import { AppConfigService } from '../config/app-config.service';

@ApiTags('image')
@Controller('image')
export class ImageController {
  constructor(
    private readonly colorParser: ColorParserService,
    private readonly imageProcessor: ImageProcessingService,
    private readonly configService: AppConfigService,
  ) {}

  @Post('remove-background')
  @ApiOperation({
    summary: 'Remove background from image',
    description:
      'Upload an image and specify background color to remove. Returns PNG with transparency.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, WebP)',
        },
        backgroundColor: {
          type: 'string',
          default: '#FFFFFF',
          description: 'Color to remove (hex, rgb, rgba, or named color)',
          example: '#FFFFFF',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'PNG image with transparent background',
    content: {
      'image/png': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or color format',
  })
  @ApiResponse({
    status: 500,
    description: 'Image processing failed',
  })
  @UseInterceptors(FileInterceptor('file'))
  async removeBackground(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 10 * 1024 * 1024, // 10MB
            message: 'File size must be less than 10MB',
          }),
          new FileTypeValidator({
            fileType: /(image\/jpeg|image\/png|image\/webp)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: RemoveBackgroundDto,
    @Res() res: Response,
  ) {
    // Validate and parse background color
    let backgroundColor;
    try {
      backgroundColor = this.colorParser.parseColor(
        dto.backgroundColor || '#FFFFFF',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Invalid color format';
      throw new BadRequestException(errorMessage);
    }

    // Process image
    const outputBuffer = await this.imageProcessor.removeBackground(
      file.buffer,
      {
        backgroundColor,
        tolerance: this.configService.tolerance,
      },
    );

    // Set response headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="removed-background-${Date.now()}.png"`,
    );
    res.setHeader('Content-Length', outputBuffer.length);

    // Send PNG file
    res.send(outputBuffer);
  }
}
