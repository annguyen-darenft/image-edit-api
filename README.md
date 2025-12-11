# NestJS Background Removal API

High-performance API for removing image backgrounds by color matching using Sharp.js.

## Features

- 🎨 Multiple color format support (#FFF, rgb(), rgba(), named colors)
- ⚡ Fast processing with libvips-powered Sharp.js
- 📦 Handles JPEG, PNG, WebP inputs
- 🔒 Secure file validation (MIME + file size limits)
- 📝 Complete Swagger API documentation
- ✅ Comprehensive test coverage

## Requirements

- Node.js ^18.17.0 or >=20.3.0
- npm 9+

## Installation

```bash
npm install
```

## Quick Start

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

API will be available at: http://localhost:3000
Swagger docs: http://localhost:3000/api/docs

## API Usage

### Remove Background

**Endpoint:** `POST /api/image/remove-background`

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `file` (required): Image file (JPEG, PNG, WebP)
  - `backgroundColor` (optional): Color to remove (default: "#FFFFFF")

**Response:**
- Content-Type: `image/png`
- PNG image with transparent background

### Example with curl

```bash
# Remove white background (default)
curl -X POST http://localhost:3000/api/image/remove-background \
  -F "file=@input.jpg" \
  -o output.png

# Remove specific color
curl -X POST http://localhost:3000/api/image/remove-background \
  -F "file=@input.png" \
  -F "backgroundColor=#00FF00" \
  -o output.png

# Using RGB format
curl -X POST http://localhost:3000/api/image/remove-background \
  -F "file=@input.jpg" \
  -F "backgroundColor=rgb(255, 255, 255)" \
  -o output.png

# Using named color
curl -X POST http://localhost:3000/api/image/remove-background \
  -F "file=@input.jpg" \
  -F "backgroundColor=white" \
  -o output.png
```

### Supported Color Formats

- **Hex:** `#FFF`, `#FFFFFF`, `#fff`, `#ffffff`
- **RGB:** `rgb(255, 255, 255)`, `rgb(255 255 255)`
- **RGBA:** `rgba(255, 255, 255, 1.0)`, `rgba(255,255,255,0.5)`
- **Named:** `white`, `black`, `red`, `green`, `blue`

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

## Configuration

Environment variables (optional):

```bash
# .env
PORT=3000
NODE_ENV=development
MAX_FILE_SIZE=5242880  # 5MB
MAX_IMAGE_PIXELS=50000000  # 50MP
SHARP_CONCURRENCY=4
```

## Project Structure

```
src/
├── image/
│   ├── dto/
│   │   └── remove-background.dto.ts
│   ├── services/
│   │   ├── color-parser/
│   │   │   ├── color-parser.service.ts
│   │   │   └── color-parser.service.spec.ts
│   │   └── image-processing/
│   │       ├── image-processing.service.ts
│   │       └── image-processing.service.spec.ts
│   ├── image.controller.ts
│   └── image.module.ts
├── app.module.ts
└── main.ts
```

## API Documentation

Visit http://localhost:3000/api/docs for interactive Swagger documentation.

## Performance

- Processes 1920x1080 images in < 2 seconds
- Memory-efficient streaming with Sharp
- File size limit: 5MB (configurable)
- Concurrent processing control

## Security

- File signature validation
- MIME type verification
- File size limits
- Input sanitization
- No file system persistence

## License

MIT
