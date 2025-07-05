# TikTok Bulk Downloader

## Overview

This is a Node.js web application that allows users to download TikTok videos without watermarks. The application supports both single video downloads and bulk downloads with real-time progress tracking. It uses web scraping techniques with Playwright to extract direct download URLs from TikTok content.

## System Architecture

The application follows a client-server architecture with the following components:

- **Frontend**: Vanilla HTML/CSS/JavaScript with Socket.IO for real-time communication
- **Backend**: Express.js server with TypeScript
- **Web Scraping**: Playwright for browser automation
- **Real-time Communication**: Socket.IO for progress updates
- **File Management**: Node.js file system for download handling

## Key Components

### Backend Services

1. **TikTok Service (`src/services/tiktok-service.ts`)**
   - Handles web scraping using Playwright
   - Extracts direct download URLs from TikTok via third-party services
   - Manages browser instances for automation
   - Configurable service endpoint (defaults to snaptik.app)

2. **Downloader Service (`src/services/downloader.ts`)**
   - Manages file downloads with progress tracking
   - Implements retry logic for failed downloads
   - Handles concurrent downloads with rate limiting
   - Provides download progress callbacks

3. **Download Routes (`src/routes/download.ts`)**
   - `/api/download/single` - Single video download endpoint
   - `/api/download/bulk` - Bulk download endpoint with concurrency control
   - Integrates with Socket.IO for real-time progress updates

### Frontend Components

1. **Main Application (`public/app.js`)**
   - TikTokDownloader class managing UI interactions
   - Socket.IO client for real-time updates
   - Tab-based interface for single/bulk downloads
   - Progress tracking and error handling

2. **User Interface (`public/index.html`, `public/style.css`)**
   - Clean, responsive design with gradient styling
   - Tabbed interface for different download modes
   - Real-time progress indicators
   - Input validation and user feedback

### Utilities

1. **Logger (`src/utils/logger.ts`)**
   - Colored console logging with timestamps
   - Multiple log levels (info, success, error, warn, debug)

2. **URL Parser (`src/utils/parseTtUrl.ts`)**
   - Parses different TikTok URL formats
   - Generates sanitized filenames with timestamps
   - Handles both full URLs and short links

## Data Flow

1. **Single Download Flow**:
   - User enters TikTok URL
   - Frontend sends request to `/api/download/single`
   - Backend parses URL and extracts video info
   - Playwright scrapes direct download URL
   - File is downloaded and saved locally
   - Response sent back to frontend

2. **Bulk Download Flow**:
   - User enters multiple URLs with concurrency setting
   - Frontend sends request to `/api/download/bulk`
   - Backend processes URLs with rate limiting (p-limit)
   - Progress updates sent via Socket.IO
   - Downloads processed concurrently
   - Completion status broadcast to client

## External Dependencies

### Core Dependencies
- **Express.js**: Web server framework
- **Socket.IO**: Real-time bidirectional communication
- **Playwright**: Browser automation for web scraping
- **Axios**: HTTP client for file downloads
- **p-limit**: Concurrency control for bulk operations

### Development Dependencies
- **TypeScript**: Type-safe JavaScript development
- **ts-node**: TypeScript execution environment
- **dotenv**: Environment variable management

### Third-party Services
- **Default Service**: snaptik.app (configurable via environment)
- Uses web scraping to extract direct download URLs
- No API keys required

## Deployment Strategy

### Environment Configuration
- `PORT`: Server port (default: 5000)
- `OUTPUT_DIR`: Download directory (default: 'downloads')
- `DOWNLOAD_SERVICE`: Third-party service URL
- `HEADLESS`: Browser headless mode (default: true)
- `SERVICE_TIMEOUT_MS`: Request timeout (default: 20000ms)
- `RETRY_LIMIT`: Download retry attempts (default: 3)

### File Structure
```
src/
├── server.ts           # Main server entry point
├── routes/
│   └── download.ts     # Download API endpoints
├── services/
│   ├── tiktok-service.ts   # Web scraping service
│   └── downloader.ts   # File download service
└── utils/
    ├── logger.ts       # Logging utility
    └── parseTtUrl.ts   # URL parsing utility
public/
├── index.html          # Frontend interface
├── app.js             # Client-side JavaScript
└── style.css          # Styling
```

### Production Considerations
- Browser dependencies need to be installed for Playwright
- Download directory should be persistent
- Consider implementing download cleanup
- Rate limiting may be needed for production use

## Changelog

```
Changelog:
- July 05, 2025. Initial setup with web interface and Playwright browser service
- July 05, 2025. Added API-based fallback service due to browser dependency issues
- July 05, 2025. Implemented dual-service architecture (browser + API fallback)
- July 05, 2025. Currently using API service as primary method due to missing system dependencies
```

## Current Status

The application is now fully functional with a web interface that includes:
- Single video download functionality 
- Bulk download with concurrency control
- Real-time progress tracking via Socket.IO
- API-based video extraction (fallback from browser service)

**Note**: Browser service requires additional system dependencies that are not available in the current environment. The application currently uses API-based extraction as the primary method.

## User Preferences

```
Preferred communication style: Simple, everyday language.
```