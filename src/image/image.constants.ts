/**
 * Image processing constants and limits
 */

export const IMAGE_CONSTANTS = {
  /** Maximum file size in bytes (10MB) */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,

  /** Maximum number of crop regions per request */
  MAX_CROP_REGIONS: 20,

  /** Minimum number of crop regions per request */
  MIN_CROP_REGIONS: 1,

  /** Maximum image dimension (width or height) */
  MAX_IMAGE_DIMENSION: 65535,

  /** PNG compression level (0-9, where 9 is maximum compression) */
  PNG_COMPRESSION_LEVEL: 9,

  /** PNG quality (0-100, where 100 is best quality) */
  PNG_QUALITY: 100,

  /** ZIP compression level (0-9, where 9 is maximum compression) */
  ZIP_COMPRESSION_LEVEL: 9,
} as const;

export const SUPPORTED_IMAGE_TYPES = /(image\/jpeg|image\/png|image\/webp)/;
