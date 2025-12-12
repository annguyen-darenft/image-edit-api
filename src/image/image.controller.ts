import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  Query,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import archiver from 'archiver';
import { ColorParserService } from './services/color-parser/color-parser.service';
import {
  ImageProcessingService,
  bufferToDataUrl,
} from './services/image-processing/image-processing.service';
import { RemoveBackgroundDto } from './dto/remove-background.dto';
import { CropImageDto, CropResponseFormat } from './dto/crop-image.dto';
import { CropRegionsResponseDto } from './dto/crop-response.dto';
import { AppConfigService } from '../config/app-config.service';
import {
  IMAGE_CONSTANTS,
  SUPPORTED_IMAGE_TYPES,
} from './image.constants';

@ApiTags('image')
@Controller('image')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

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
            maxSize: IMAGE_CONSTANTS.MAX_FILE_SIZE_BYTES,
            message: `File size must be less than ${IMAGE_CONSTANTS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
          }),
          new FileTypeValidator({
            fileType: SUPPORTED_IMAGE_TYPES,
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

  @Post('crop-regions')
  @ApiOperation({
    summary: 'Crop multiple regions from image',
    description:
      'Upload an image and specify regions to crop. Returns JSON (default) or ZIP based on format parameter.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'format',
    required: false,
    enum: CropResponseFormat,
    description: 'Response format: json (default) or zip',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, WebP)',
        },
        regions: {
          type: 'string',
          description:
            'JSON array of crop regions with position {x, y} and size {w, h}',
          example:
            '[{"position":{"x":0,"y":0},"size":{"w":100,"h":100}},{"position":{"x":200,"y":200},"size":{"w":150,"h":150}}]',
        },
        includeBackground: {
          type: 'string',
          default: 'true',
          description: 'Include background image with transparent cropped regions',
        },
      },
      required: ['file', 'regions'],
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'JSON response with base64-encoded images (format=json) or ZIP file (format=zip)',
    type: CropRegionsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file, regions, or crop coordinates out of bounds',
  })
  @ApiResponse({
    status: 500,
    description: 'Image processing failed',
  })
  @UseInterceptors(FileInterceptor('file'))
  async cropRegions(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: IMAGE_CONSTANTS.MAX_FILE_SIZE_BYTES,
            message: `File size must be less than ${IMAGE_CONSTANTS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
          }),
          new FileTypeValidator({
            fileType: SUPPORTED_IMAGE_TYPES,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('regions') regionsJson: string,
    @Body('includeBackground') includeBackgroundStr: string = 'true',
    @Query('format') format: CropResponseFormat = CropResponseFormat.JSON,
    @Res() res?: Response,
  ): Promise<CropRegionsResponseDto | void> {
    // Parse regions JSON and transform to DTO
    let cropDto: CropImageDto;
    try {
      const regions = JSON.parse(regionsJson);
      cropDto = {
        regions,
        includeBackground:
          includeBackgroundStr === 'true' ||
          includeBackgroundStr === '1' ||
          includeBackgroundStr === undefined,
      };
    } catch (error) {
      throw new BadRequestException(
        'Invalid regions JSON: ' +
          (error instanceof Error ? error.message : 'Parse error'),
      );
    }

    // Process image
    const result = await this.imageProcessor.cropRegions(
      file.buffer,
      cropDto.regions,
      cropDto.includeBackground,
    );

    // Handle ZIP format
    if (format === CropResponseFormat.ZIP) {
      if (!res) {
        throw new BadRequestException('Response object is required for ZIP format');
      }

      // Create ZIP archive
      const archive = archiver('zip', {
        zlib: { level: IMAGE_CONSTANTS.ZIP_COMPRESSION_LEVEL },
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cropped-images-${Date.now()}.zip"`,
      );

      // Handle archive errors
      let archiveErrorOccurred = false;
      archive.on('error', (err) => {
        archiveErrorOccurred = true;
        this.logger.error('Archive creation failed', err.stack);
        if (!res.headersSent) {
          throw new BadRequestException('Failed to create ZIP: ' + err.message);
        }
        res.destroy();
      });

      // Pipe archive to response
      archive.pipe(res);

      // Add cropped images to archive
      result.croppedImages.forEach((buffer, index) => {
        if (!archiveErrorOccurred) {
          archive.append(buffer, { name: `crop-${index + 1}.png` });
        }
      });

      // Add background image if included
      if (result.backgroundImage && !archiveErrorOccurred) {
        archive.append(result.backgroundImage, { name: 'background.png' });
      }

      // Add metadata file
      if (!archiveErrorOccurred) {
        archive.append(JSON.stringify(result.metadata, null, 2), {
          name: 'metadata.json',
        });
      }

      // Finalize archive
      try {
        await archive.finalize();
      } catch (error) {
        if (!res.headersSent) {
          throw new BadRequestException(
            'Failed to finalize ZIP: ' +
              (error instanceof Error ? error.message : 'Unknown error'),
          );
        }
      }

      return;
    }

    // Handle JSON format (default)
    const croppedImages = result.croppedImages.map((buffer, index) => ({
      index,
      data: bufferToDataUrl(buffer),
      position: result.metadata.croppedRegions[index].position,
      size: result.metadata.croppedRegions[index].size,
    }));

    const backgroundImage = result.backgroundImage
      ? { data: bufferToDataUrl(result.backgroundImage) }
      : null;

    return {
      croppedImages,
      backgroundImage,
      metadata: {
        originalDimensions: result.metadata.originalDimensions,
        totalRegions: result.metadata.croppedRegions.length,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
