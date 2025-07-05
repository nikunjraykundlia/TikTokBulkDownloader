import { Router, Request, Response } from 'express';
import { tiktokService } from '../services/tiktok-service';
import { downloader } from '../services/downloader';
import { parseTikTokUrl, generateFilename } from '../utils/parseTtUrl';
import { logger } from '../utils/logger';
import pLimit from 'p-limit';

const router = Router();

interface DownloadRequest {
  urls: string[];
  concurrency?: number;
}

router.post('/single', async (req: Request, res: Response): Promise<any> => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const urlInfo = parseTikTokUrl(url);
    const filename = generateFilename(urlInfo);
    
    const videoInfo = await tiktokService.getDirectUrl(url);
    const filePath = await downloader.downloadFile(videoInfo.directUrl, filename);
    
    res.json({
      success: true,
      filename,
      filePath,
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
    const { urls, concurrency = 3 } = req.body as DownloadRequest;
    const io = req.app.get('io');
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }
    
    const limit = pLimit(concurrency);
    const sessionId = `bulk-${Date.now()}`;
    
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
            
            const videoInfo = await tiktokService.getDirectUrl(url);
            
            // Download with progress tracking
            const filePath = await downloader.downloadFile(
              videoInfo.directUrl,
              filename,
              (progress) => {
                io.emit('download-progress', {
                  sessionId,
                  ...progress,
                  index
                });
              }
            );
            
            return {
              url,
              filename,
              filePath,
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

router.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    service: process.env.DOWNLOAD_SERVICE || 'https://snaptik.app',
    outputDir: process.env.OUTPUT_DIR || 'downloads'
  });
});

export default router;
