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

### Using Docker (Recommended)

```bash
# Build and start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Using Node.js

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

API will be available at: http://localhost:3000
Swagger docs: http://localhost:3000/api/docs
Health check: http://localhost:3000/api/health

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

# Image Processing Configuration
# Default Euclidean distance threshold for color matching
# 0 = exact match only (default)
# Higher values (e.g., 10-50) allow more color variation
TOLERANCE=0
```

### Tolerance Parameter

The `TOLERANCE` environment variable controls how strictly colors must match the target background color:

- **`TOLERANCE=0`** (default): Only exact color matches are removed
- **`TOLERANCE=10`**: Removes colors within a small range (good for JPEG artifacts)
- **`TOLERANCE=30`**: More aggressive removal (handles lighting variations)
- **`TOLERANCE=50`**: Very aggressive (may remove similar colors unintentionally)

The tolerance uses Euclidean distance in RGB space:
```
distance = √[(R₁-R₂)² + (G₁-G₂)² + (B₁-B₂)²]
```

**Recommended values:**
- PNG images with solid backgrounds: `0-10`
- JPEG images with compression artifacts: `10-20`
- Images with lighting variations: `20-40`

## Docker Deployment

### Docker Compose (Production)

The project includes production-ready Docker configuration:

```bash
# Build and start
docker-compose up -d

# Check container status and health
docker ps
docker inspect nestjs-rembg-api --format='{{.State.Health.Status}}'

# View logs
docker-compose logs -f api

# Stop and remove
docker-compose down
```

### Docker Image Details

- **Base Image**: `node:18-alpine`
- **Image Size**: ~388MB (multi-stage build optimized)
- **Sharp.js Support**: Native libvips dependencies included
- **Security**: Runs as non-root user (UID 1001)
- **Health Check**: Built-in health monitoring on `/api/health`

### Environment Variables in Docker

Override environment variables in `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - TOLERANCE=20  # Adjust tolerance as needed
```

### Resource Limits

Default resource limits (configurable in `docker-compose.yml`):
- CPU: 0.5-1 core
- Memory: 256-512MB

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
- File size limit: 10MB (configurable)
- Concurrent processing control

## Security

- File signature validation
- MIME type verification
- File size limits
- Input sanitization
- No file system persistence

## License

MIT
