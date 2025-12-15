# NestJS Background Removal API

High-performance API for removing image backgrounds by color matching using Sharp.js.

## Features

- 🎨 Multiple color format support (#FFF, rgb(), rgba(), named colors)
- ✂️ Multiple region cropping with background generation
- ⚡ Fast processing with libvips-powered Sharp.js
- 📦 Handles JPEG, PNG, WebP inputs
- 📊 Flexible response: JSON (base64) or ZIP file
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

### Crop Regions

**Endpoint:** `POST /api/image/crop-regions?format={json|zip}`

**Request:**
- Content-Type: `multipart/form-data`
- Query Parameters:
  - `format` (optional): Response format - `json` (default) or `zip`
- Form Fields:
  - `file` (required): Image file (JPEG, PNG, WebP)
  - `regions` (required): JSON array of crop regions
  - `includeBackground` (optional): Include background image (default: "true")

**Response Formats:**

**JSON format** (default, `format=json`):
- Content-Type: `application/json`
- JSON object containing:
  - `croppedImages`: Array of cropped images with base64 data URLs
  - `backgroundImage`: Background image with transparent regions (null if not included)
  - `metadata`: Crop details and dimensions

**ZIP format** (`format=zip`):
- Content-Type: `application/zip`
- ZIP file containing:
  - `crop-1.png`, `crop-2.png`, etc. - Cropped images
  - `background.png` - Original image with cropped regions transparent
  - `metadata.json` - Crop details and dimensions

### Example with curl

```bash
# JSON format (default) - Returns base64-encoded images
curl -X POST http://localhost:3000/api/image/crop-regions \
  -F "file=@input.jpg" \
  -F 'regions=[{"position":{"x":100,"y":100},"size":{"w":200,"h":200}},{"position":{"x":400,"y":300},"size":{"w":150,"h":150}}]' \
  | jq

# Explicit JSON format
curl -X POST "http://localhost:3000/api/image/crop-regions?format=json" \
  -F "file=@input.jpg" \
  -F 'regions=[{"position":{"x":0,"y":0},"size":{"w":100,"h":100}}]' \
  -o response.json

# ZIP format - Returns ZIP file with PNG images
curl -X POST "http://localhost:3000/api/image/crop-regions?format=zip" \
  -F "file=@input.jpg" \
  -F 'regions=[{"position":{"x":0,"y":0},"size":{"w":100,"h":100}},{"position":{"x":200,"y":200},"size":{"w":150,"h":150}}]' \
  -o cropped-images.zip

# ZIP format without background image
curl -X POST "http://localhost:3000/api/image/crop-regions?format=zip" \
  -F "file=@input.png" \
  -F 'regions=[{"position":{"x":0,"y":0},"size":{"w":100,"h":100}}]' \
  -F "includeBackground=false" \
  -o crops.zip

# With object identifiers (from detect-bounding-boxes)
curl -X POST http://localhost:3000/api/image/crop-regions \
  -F "file=@comic.jpg" \
  -F 'regions=[{"position":{"x":245,"y":180},"size":{"w":320,"h":580},"object":"cậu bé"},{"position":{"x":890,"y":220},"size":{"w":280,"h":540},"object":"bà cụ"}]' \
  | jq
```

**Regions Format:**
```json
[
  {
    "position": { "x": 100, "y": 100 },
    "size": { "w": 200, "h": 200 },
    "object": "cậu bé"
  },
  {
    "position": { "x": 400, "y": 300 },
    "size": { "w": 150, "h": 150 },
    "object": "bà cụ"
  }
]
```

**Note:** The `object` property is optional and can be used to link crop regions with `detect-bounding-boxes` results. When provided, it will be included in the response to identify each cropped image.

**Response Format:**
```json
{
  "croppedImages": [
    {
      "index": 0,
      "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "position": { "x": 100, "y": 100 },
      "size": { "width": 200, "height": 200 },
      "object": "cậu bé"
    },
    {
      "index": 1,
      "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "position": { "x": 400, "y": 300 },
      "size": { "width": 150, "height": 150 },
      "object": "bà cụ"
    }
  ],
  "backgroundImage": {
    "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  },
  "metadata": {
    "originalDimensions": { "width": 1920, "height": 1080 },
    "totalRegions": 2,
    "timestamp": "2025-12-12T16:15:00.000Z"
  }
}
```

**Using Base64 Images:**
```javascript
// In JavaScript/TypeScript
const response = await fetch('/api/image/crop-regions', {
  method: 'POST',
  body: formData
});
const data = await response.json();

// Use data URL directly in img tag
document.querySelector('#crop1').src = data.croppedImages[0].data;

// Or convert to Blob for download
const base64 = data.croppedImages[0].data.split(',')[1];
const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
  { type: 'image/png' });
```

**Format Comparison:**

| Feature | JSON (default) | ZIP |
|---------|---------------|-----|
| **Response Size** | ~33% larger (base64) | Smallest |
| **Client Usage** | Direct in `<img>` tags | Need unzipping |
| **Memory** | Higher (all in memory) | Lower (streaming) |
| **Best For** | Web apps, small batches | Large batches, downloads |

**Constraints:**
- Minimum 1 region, maximum 20 regions per request
- Coordinates and dimensions: 0-65535
- Regions must be within image bounds
- All coordinates must be positive integers
- JSON format: Base64 increases payload size by ~33%
- ZIP format: Streaming response, no extra memory overhead

### Detect Bounding Boxes with Gemini AI

**Endpoint:** `POST /api/image/detect-bounding-boxes`

Detect objects in comic images using Google Gemini 3 Pro vision AI with custom Vietnamese descriptions. Returns bounding box coordinates in absolute pixels.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `file` (required): Image file (JPEG, PNG, WebP, max 10MB)
  - `objects` (required): JSON array of objects to detect with Vietnamese descriptions

**Response:**
- Content-Type: `application/json`
- Bounding boxes with absolute pixel coordinates

**Note:** Image dimensions are automatically extracted from the uploaded file.

### Example with curl

```bash
curl -X POST http://localhost:3000/api/image/detect-bounding-boxes \
  -F "file=@comic.jpg" \
  -F 'objects=[
    {
      "name": "cậu bé",
      "description": "cậu bé, tóc đen, đi chân đất, quấn khăn trên đầu"
    },
    {
      "name": "bà cụ",
      "description": "bà cụ tóc trắng, đi chân đất, đang cầm thanh sắt mài vào tảng đá"
    }
  ]' \
  | jq
```

**Response Format:**
```json
{
  "boundingBoxes": [
    {
      "object": "cậu bé",
      "position": { "x": 245, "y": 180 },
      "size": { "w": 320, "h": 580 }
    },
    {
      "object": "bà cụ",
      "position": { "x": 890, "y": 220 },
      "size": { "w": 280, "h": 540 }
    }
  ],
  "totalDetected": 2,
  "timestamp": "2025-12-15T11:30:00.000Z"
}
```

**Coordinate System:**
- `position.x`: X coordinate from left edge (pixels)
- `position.y`: Y coordinate from top edge (pixels)
- `size.w`: Width in pixels
- `size.h`: Height in pixels

**Detection Requirements:**
Each bounding box includes:
- Entire body of the character
- Shadow on the ground
- Any objects the character is holding or directly interacting with

**Constraints:**
- Minimum 1 object, maximum 25 objects per request (Gemini API limit)
- Image dimensions automatically detected from uploaded file
- All object names and descriptions in Vietnamese
- Processing time: typically < 10 minutes for 2MP images

### Workflow: Detect and Crop Objects

Combine `detect-bounding-boxes` and `crop-regions` APIs to automatically detect and extract objects:

```bash
# Step 1: Detect bounding boxes
curl -X POST http://localhost:3000/api/image/detect-bounding-boxes \
  -F "file=@comic.jpg" \
  -F 'objects=[
    {"name":"cậu bé","description":"cậu bé, tóc đen, đi chân đất, quấn khăn trên đầu"},
    {"name":"bà cụ","description":"bà cụ tóc trắng, đi chân đất, đang cầm thanh sắt mài vào tảng đá"}
  ]' > bboxes.json

# Step 2: Extract boundingBoxes array from response and use as regions for cropping
# The bounding boxes already include position {x, y}, size {w, h}, and object name
curl -X POST http://localhost:3000/api/image/crop-regions \
  -F "file=@comic.jpg" \
  -F "regions=$(cat bboxes.json | jq -c '.boundingBoxes')" \
  | jq
```

**Result:** Cropped images with object identifiers matching the detected objects.

**Configuration:**
Set up your Gemini API key in `.env`:

```bash
# Get your API key from: https://aistudio.google.com/apikey
GOOGLE_GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3-pro-preview
GEMINI_API_TIMEOUT=600000
```

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
│   │   ├── remove-background.dto.ts
│   │   └── crop-image.dto.ts
│   ├── services/
│   │   ├── color-parser/
│   │   │   ├── color-parser.service.ts
│   │   │   └── color-parser.service.spec.ts
│   │   └── image-processing/
│   │       ├── image-processing.service.ts
│   │       └── image-processing.service.spec.ts
│   ├── image.controller.ts
│   ├── image.module.ts
│   └── image.constants.ts
├── config/
│   ├── app-config.service.ts
│   ├── config.module.ts
│   └── env.validation.ts
├── app.module.ts
└── main.ts
```

## API Documentation

Visit http://localhost:3000/api/docs for interactive Swagger documentation.

## Performance

- Processes 1920x1080 images in < 2 seconds
- Memory-efficient streaming with Sharp
- Parallel crop processing for multiple regions
- File size limit: 10MB (configurable)
- Maximum 20 crop regions per request
- Flexible response formats:
  - **JSON**: Base64-encoded images (~33% overhead), best for web apps
  - **ZIP**: Streaming compression, best for large batches or downloads

## Security

- File signature validation
- MIME type verification
- File size limits
- Input sanitization
- No file system persistence

## License

MIT
