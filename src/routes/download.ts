import { Router, Request, Response } from 'express';
import { tiktokService } from '../services/tiktok-service';
import { tiktokApiService } from '../services/tiktok-api-service';
import { downloader } from '../services/downloader';
import { parseTikTokUrl, generateFilename } from '../utils/parseTtUrl';
import { logger } from '../utils/logger';
import pLimit from 'p-limit';
import { promises as fs } from 'fs';
import path from 'path';

// Session management for bulk downloads
const activeSessions = new Map<string, { cancelled: boolean, completed: number, total: number }>();

const router = Router();

interface DownloadRequest {
  urls: string[];
  concurrency?: number;
}

// Helper function to get video info with fallback
async function getVideoInfo(url: string) {
  // Use API service as primary method in this environment
  logger.info('Using API service for video extraction...');
  return await tiktokApiService.getDirectUrl(url);
}

router.post('/single', async (req: Request, res: Response): Promise<any> => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const urlInfo = parseTikTokUrl(url);
    const filename = generateFilename(urlInfo);
    
    const videoInfo = await getVideoInfo(url);
    const filePath = await downloader.downloadFile(videoInfo.directUrl, filename);
    
    res.json({
      success: true,
      filename,
      filePath,
      downloadUrl: `/api/download/file/${filename}`,
      videoInfo
    });
    
  } catch (error) {
    logger.error(`Single download failed: ${error}`);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Download failed' 
    });
  }
});

router.post('/bulk', async (req: Request, res: Response): Promise<any> => {
  try {
    const { urls, concurrency = 2 } = req.body as DownloadRequest;
    const io = req.app.get('io');
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }
    
    const limit = pLimit(concurrency);
    const sessionId = `bulk-${Date.now()}`;
    
    // Initialize session tracking
    activeSessions.set(sessionId, { cancelled: false, completed: 0, total: urls.length });
    
    // Send initial response
    res.json({
      success: true,
      sessionId,
      message: 'Bulk download started',
      totalUrls: urls.length
    });
    
    // Process downloads
    const results = await Promise.allSettled(
      urls.map((url, index) =>
        limit(async () => {
          try {
            const sessionState = activeSessions.get(sessionId);
            
            // Check if session is cancelled or completed
            if (!sessionState || sessionState.cancelled || sessionState.completed >= sessionState.total) {
              logger.info(`Session ${sessionId} cancelled or completed, skipping download`);
              return { url, filename: '', filePath: null, downloadUrl: null, videoInfo: null, success: false, error: 'Session cancelled' };
            }
            
            // Add delay to prevent API rate limiting and server overload
            await new Promise(resolve => setTimeout(resolve, index * 2000));
            
            const urlInfo = parseTikTokUrl(url);
            const filename = generateFilename(urlInfo);
            
            // Emit progress update
            io.emit('download-progress', {
              sessionId,
              url,
              filename,
              status: 'fetching-url',
              progress: 0,
              index
            });
            
            const videoInfo = await getVideoInfo(url);
            
            // Download with progress tracking
            const filePath = await downloader.downloadFile(
              videoInfo.directUrl,
              filename,
              (progress) => {
                io.emit('download-progress', {
                  sessionId,
                  url: progress.url,
                  filename: progress.filename,
                  status: progress.status,
                  progress: progress.progress,
                  error: progress.error,
                  index
                });
              }
            );
            
            // Update session progress
            const currentSession = activeSessions.get(sessionId);
            if (currentSession) {
              currentSession.completed++;
              logger.info(`Session ${sessionId}: ${currentSession.completed}/${currentSession.total} completed`);
            }
            
            return {
              url,
              filename,
              filePath,
              downloadUrl: `/api/download/file/${filename}`,
              videoInfo,
              success: true
            };
            
          } catch (error) {
            logger.error(`Download failed for ${url}: ${error}`);
            
            io.emit('download-progress', {
              sessionId,
              url,
              filename: '',
              status: 'failed',
              progress: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
              index
            });
            
            return {
              url,
              error: error instanceof Error ? error.message : 'Unknown error',
              success: false
            };
          }
        })
      )
    );
    
    // Send completion summary
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    
    // Clean up session
    activeSessions.delete(sessionId);
    
    io.emit('download-complete', {
      sessionId,
      total: urls.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
    });
    
  } catch (error) {
    logger.error(`Bulk download failed: ${error}`);
    const io = req.app.get('io');
    io.emit('download-error', {
      error: error instanceof Error ? error.message : 'Bulk download failed'
    });
  }
});

router.post('/stop/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  const session = activeSessions.get(sessionId);
  
  if (session) {
    session.cancelled = true;
    logger.info(`Session ${sessionId} marked for cancellation`);
    
    // Emit stop event to clients
    const io = req.app.get('io');
    io.emit('download-stopped', { sessionId });
    
    res.json({ success: true, message: 'Download stopped' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

router.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    service: process.env.DOWNLOAD_SERVICE || 'https://snaptik.app',
    outputDir: process.env.OUTPUT_DIR || 'downloads',
    activeSessions: Array.from(activeSessions.keys())
  });
});

// New endpoint to serve downloaded files
router.get('/file/:filename', async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(process.env.OUTPUT_DIR || 'downloads', filename);
    
    // Check if file exists
    await fs.access(filePath);
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    
    // Send file
    res.sendFile(path.resolve(filePath));
    
  } catch (error) {
    logger.error(`File serving failed: ${error.message}`);
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
