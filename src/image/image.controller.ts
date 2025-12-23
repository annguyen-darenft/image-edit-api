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
  RequestTimeoutException,
  InternalServerErrorException,
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
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ColorParserService } from './services/color-parser/color-parser.service';
import {
  ImageProcessingService,
  bufferToDataUrl,
} from './services/image-processing/image-processing.service';
import { GeminiService } from './services/gemini/gemini.service';
import { BoundingBoxTransformService } from './services/bounding-box-transform/bounding-box-transform.service';
import { ReplicateService } from './services/replicate/replicate.service';
import { RemoveBackgroundDto } from './dto/remove-background.dto';
import { CropImageDto, CropResponseFormat } from './dto/crop-image.dto';
import { CropRegionsResponseDto } from './dto/crop-response.dto';
import {
  DetectBoundingBoxesDto,
  ObjectDescriptionDto,
} from './dto/detect-bounding-boxes.dto';
import { DetectBoundingBoxesResponseDto } from './dto/bounding-box-response.dto';
import {
  Sam2SegmentationDto,
  ResponseFormat,
} from './dto/sam2-segmentation.dto';
import {
  Sam2SegmentationResponseDto,
  SegmentationMaskDto,
  CombinedMaskDto,
} from './dto/sam2-response.dto';
import { CropObjectGeminiDto } from './dto/crop-object-gemini.dto';
import { AppConfigService } from '../config/app-config.service';
import { IMAGE_CONSTANTS, SUPPORTED_IMAGE_TYPES } from './image.constants';

@ApiTags('image')
@Controller('image')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(
    private readonly colorParser: ColorParserService,
    private readonly imageProcessor: ImageProcessingService,
    private readonly geminiService: GeminiService,
    private readonly boundingBoxTransformService: BoundingBoxTransformService,
    private readonly replicateService: ReplicateService,
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
            'JSON array of crop regions with position {x, y}, size {w, h}, and optional object identifier',
          example:
            '[{"position":{"x":0,"y":0},"size":{"w":100,"h":100},"object":"cậu bé"},{"position":{"x":200,"y":200},"size":{"w":150,"h":150},"object":"bà cụ"}]',
        },
        includeBackground: {
          type: 'string',
          default: 'true',
          description:
            'Include background image with transparent cropped regions',
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
        throw new BadRequestException(
          'Response object is required for ZIP format',
        );
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
      object: result.metadata.croppedRegions[index].object,
      data: bufferToDataUrl(buffer),
      position: result.metadata.croppedRegions[index].position,
      size: result.metadata.croppedRegions[index].size,
    }));

    const backgroundImage = result.backgroundImage
      ? { data: bufferToDataUrl(result.backgroundImage) }
      : null;

    const apiResult = {
      croppedImages,
      backgroundImage,
      metadata: {
        originalDimensions: result.metadata.originalDimensions,
        totalRegions: result.metadata.croppedRegions.length,
        timestamp: new Date().toISOString(),
      },
    };
    if (res) res.json(apiResult);
    else {
      return apiResult;
    }
  }

  @Post('detect-bounding-boxes')
  @ApiOperation({
    summary: 'Detect bounding boxes of objects in image using Gemini AI',
    description:
      'Provide either an image URL or upload an image file, and specify objects to detect with Vietnamese descriptions. Returns bounding box coordinates in absolute pixels.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Image file (JPEG, PNG, WebP) - optional if imageUrl is provided',
        },
        imageUrl: {
          type: 'string',
          description:
            'URL of the image to process - optional if file is provided',
          example: 'https://example.com/image.jpg',
        },
        objects: {
          type: 'string',
          description: 'JSON array of object descriptions',
          example: JSON.stringify([
            {
              name: 'cậu bé',
              description: 'cậu bé quấn khăn trên đầu',
            },
            {
              name: 'bà cụ',
              description: 'bà cụ tóc trắng',
            },
          ]),
        },
      },
      required: ['objects'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Bounding boxes detected successfully',
    type: DetectBoundingBoxesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file, objects, imageUrl, or image size',
  })
  @ApiResponse({
    status: 500,
    description: 'Gemini API error or processing failed',
  })
  @UseInterceptors(FileInterceptor('file'))
  async detectBoundingBoxes(
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
        fileIsRequired: false,
      }),
    )
    file: Express.Multer.File | undefined,
    @Body('objects') objectsJson: string,
    @Body('imageUrl') imageUrl?: string,
  ): Promise<DetectBoundingBoxesResponseDto> {
    // Validate that either file or imageUrl is provided
    if (!file && !imageUrl) {
      throw new BadRequestException(
        'Either file upload or imageUrl must be provided',
      );
    }

    // Parse and validate DTO
    let dto: DetectBoundingBoxesDto;
    try {
      const objects = JSON.parse(objectsJson);
      dto = plainToInstance(DetectBoundingBoxesDto, { objects, imageUrl });

      const errors = await validate(dto);
      if (errors.length > 0) {
        throw new BadRequestException(
          errors.map((e) => Object.values(e.constraints || {})).flat(),
        );
      }
    } catch (error) {
      throw new BadRequestException(
        'Invalid JSON format: ' +
          (error instanceof Error ? error.message : 'Parse error'),
      );
    }

    // Prepare image buffer and mimetype
    let imageBuffer: Buffer;
    let imageMimeType: string;

    if (imageUrl) {
      // Fetch image from URL
      this.logger.log(`Fetching image from URL: ${imageUrl}`);
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new BadRequestException(
            `Failed to fetch image from URL: ${response.status} ${response.statusText}`,
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        imageMimeType = response.headers.get('content-type') || 'image/jpeg';

        // Validate content type
        if (!imageMimeType.startsWith('image/')) {
          throw new BadRequestException(
            `URL does not point to an image. Content-Type: ${imageMimeType}`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          'Failed to fetch image from URL: ' +
            (error instanceof Error ? error.message : 'Unknown error'),
        );
      }
    } else {
      // Use uploaded file
      imageBuffer = file!.buffer;
      imageMimeType = file!.mimetype;
    }

    // Extract image dimensions
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(imageBuffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException(
        'Failed to extract image dimensions from image',
      );
    }

    const imageSize = {
      width: metadata.width,
      height: metadata.height,
    };

    this.logger.log(
      `Processing image: ${imageSize.width}x${imageSize.height}, ${dto.objects.length} objects, mimetype ${imageMimeType}`,
    );

    // Detect bounding boxes with Gemini
    const geminiBoundingBoxes = await this.geminiService.detectBoundingBoxes(
      imageBuffer,
      dto.objects,
      imageMimeType,
    );

    // Transform to API format
    const boundingBoxes = this.boundingBoxTransformService.transform(
      geminiBoundingBoxes,
      dto.objects,
      imageSize,
    );

    return {
      boundingBoxes,
      totalDetected: boundingBoxes.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('segment-sam2')
  @ApiOperation({
    summary: 'Automatic object segmentation using SAM 2 AI model',
    description:
      'Upload an image for automatic segmentation. SAM 2 detects all objects and returns masks. Returns JSON (base64) or ZIP file.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ResponseFormat,
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
        points_per_side: {
          type: 'string',
          default: '32',
          description:
            'Points per side for mask generation (1-64, higher = more fine-grained)',
          example: '32',
        },
        pred_iou_thresh: {
          type: 'string',
          default: '0.88',
          description: 'Predicted IOU threshold (0-1)',
          example: '0.88',
        },
        stability_score_thresh: {
          type: 'string',
          default: '0.95',
          description: 'Stability score threshold (0-1)',
          example: '0.95',
        },
        use_m2m: {
          type: 'string',
          default: 'true',
          description: 'Use Mask-to-Mask refinement',
          example: 'true',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'JSON response with base64-encoded masks (format=json) or ZIP file (format=zip)',
    type: Sam2SegmentationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Segmentation processing failed',
  })
  @UseInterceptors(FileInterceptor('file'))
  async segmentSam2(
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
    @Body() body: any,
    @Query('format') format: ResponseFormat = ResponseFormat.JSON,
    @Res() res: Response,
  ) {
    const startTime = Date.now();

    // Parse and validate DTO
    const dto = plainToInstance(Sam2SegmentationDto, {
      points_per_side: body.points_per_side
        ? parseInt(body.points_per_side)
        : undefined,
      pred_iou_thresh: body.pred_iou_thresh
        ? parseFloat(body.pred_iou_thresh)
        : undefined,
      stability_score_thresh: body.stability_score_thresh
        ? parseFloat(body.stability_score_thresh)
        : undefined,
      use_m2m: body.use_m2m !== undefined ? body.use_m2m === 'true' : undefined,
      format,
    });

    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(errors.toString());
    }

    this.logger.log(
      `SAM 2 automatic segmentation request (points_per_side: ${dto.points_per_side || 32})`,
    );

    // Get image dimensions
    const imageMetadata = await this.imageProcessor.extractImageMetadata(
      file.buffer,
    );

    // Convert image to data URL for Replicate API
    const imageDataUrl = this.replicateService.convertBufferToDataUrl(
      file.buffer,
      file.mimetype,
    );

    // Run SAM 2 automatic segmentation
    const segmentationResult = await this.replicateService.runSam2Segmentation({
      image: imageDataUrl,
      points_per_side: dto.points_per_side,
      pred_iou_thresh: dto.pred_iou_thresh,
      stability_score_thresh: dto.stability_score_thresh,
      use_m2m: dto.use_m2m,
    });

    // Download combined mask and individual masks
    const [combinedMaskBuffer, ...individualMaskBuffers] = await Promise.all([
      this.replicateService.downloadMask(segmentationResult.combined_mask),
      ...segmentationResult.individual_masks.map((maskUrl) =>
        this.replicateService.downloadMask(maskUrl),
      ),
    ]);

    const processingTimeMs = Date.now() - startTime;

    // JSON format response
    if (format === ResponseFormat.JSON) {
      const individualMasks: SegmentationMaskDto[] = individualMaskBuffers.map(
        (buffer, index) => ({
          index,
          data: bufferToDataUrl(buffer, 'image/png'),
        }),
      );

      const combinedMask: CombinedMaskDto = {
        data: bufferToDataUrl(combinedMaskBuffer, 'image/png'),
      };

      const response: Sam2SegmentationResponseDto = {
        combinedMask,
        individualMasks,
        metadata: {
          originalDimensions: {
            width: imageMetadata.width,
            height: imageMetadata.height,
          },
          totalIndividualMasks: individualMasks.length,
          pointsPerSide: dto.points_per_side || 32,
          predIouThresh: dto.pred_iou_thresh,
          stabilityScoreThresh: dto.stability_score_thresh,
          useM2m: dto.use_m2m,
          timestamp: new Date().toISOString(),
          processingTimeMs,
        },
      };

      return response;
    }

    // ZIP format response
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sam2-masks-${Date.now()}.zip"`,
    );

    const archive = archiver('zip', {
      zlib: { level: IMAGE_CONSTANTS.ZIP_COMPRESSION_LEVEL },
    });

    archive.pipe(res);

    // Add combined mask
    archive.append(combinedMaskBuffer, { name: 'combined-mask.png' });

    // Add individual masks
    individualMaskBuffers.forEach((buffer, index) => {
      archive.append(buffer, { name: `mask-${index + 1}.png` });
    });

    // Add metadata JSON
    const metadata = {
      originalDimensions: {
        width: imageMetadata.width,
        height: imageMetadata.height,
      },
      totalIndividualMasks: individualMaskBuffers.length,
      pointsPerSide: dto.points_per_side || 32,
      predIouThresh: dto.pred_iou_thresh,
      stabilityScoreThresh: dto.stability_score_thresh,
      useM2m: dto.use_m2m,
      timestamp: new Date().toISOString(),
      processingTimeMs,
    };

    archive.append(JSON.stringify(metadata, null, 2), {
      name: 'metadata.json',
    });

    await archive.finalize();
  }

  @Post('crop-object-gemini')
  @ApiOperation({
    summary: 'Crop and isolate object using Gemini AI',
    description:
      'Use Gemini image generation to isolate main object/character from image, ' +
      'restore occluded parts, and set non-conflicting background color',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, WebP, max 10MB)',
        },
        objectName: {
          type: 'string',
          description: 'Name/identifier of target object to isolate',
          example: 'cậu bé',
        },
        objectDescription: {
          type: 'string',
          description: 'Optional additional description of target object',
          example: 'tóc đen, đi chân đất, quấn khăn trên đầu',
        },
      },
      required: ['file', 'objectName'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'PNG image with isolated object and clean background',
    content: {
      'image/png': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input or file format' })
  @ApiResponse({ status: 408, description: 'Request timeout' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseInterceptors(FileInterceptor('file'))
  async cropObjectGemini(
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
    @Body() body: any,
    @Res() res: Response,
  ): Promise<void> {
    // Parse and validate form fields
    const dto = plainToInstance(CropObjectGeminiDto, {
      objectName: body.objectName,
      objectDescription: body.objectDescription,
    });

    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(
        errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .join('; '),
      );
    }

    this.logger.log(
      `Cropping object "${dto.objectName}" from ${file.originalname}`,
    );

    try {
      // Call Gemini service
      const pngBuffer = await this.geminiService.cropObjectWithGemini(
        file.buffer,
        dto.objectName,
        dto.objectDescription,
        file.mimetype,
      );

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = dto.objectName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const filename = `cropped-object-${safeName}-${timestamp}.png`;

      // Set response headers
      res.set({
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pngBuffer.length.toString(),
      });

      // Stream response
      res.end(pngBuffer);
    } catch (error) {
      this.logger.error('Failed to crop object', error);

      if (error instanceof RequestTimeoutException) {
        throw error;
      }

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to process image: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }
}
