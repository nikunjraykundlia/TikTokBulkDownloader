import axios from 'axios';
import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface DownloadProgress {
  url: string;
  filename: string;
  progress: number;
  status: 'downloading' | 'completed' | 'failed';
  error?: string;
}

export class Downloader {
  private readonly outputDir: string;
  private readonly retryLimit: number;

  constructor() {
    this.outputDir = process.env.OUTPUT_DIR || 'downloads';
    this.retryLimit = Number(process.env.RETRY_LIMIT) || 3;
  }

  async ensureOutputDir(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  async downloadFile(
    url: string, 
    filename: string, 
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    await this.ensureOutputDir();
    
    const filePath = path.join(this.outputDir, filename);
    let attempt = 0;
    
    while (attempt < this.retryLimit) {
      try {
        logger.info(`Downloading ${filename} (attempt ${attempt + 1}/${this.retryLimit})`);
        
        const response = await axios.get(url, {
          responseType: 'stream',
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        
        const writer = createWriteStream(filePath);
        
        response.data.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length;
          const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
          
          if (onProgress) {
            onProgress({
              url,
              filename,
              progress,
              status: 'downloading'
            });
          }
        });
        
        response.data.pipe(writer);
        
        await new Promise<void>((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
          response.data.on('error', reject);
        });
        
        logger.success(`Downloaded: ${filename}`);
        
        if (onProgress) {
          onProgress({
            url,
            filename,
            progress: 100,
            status: 'completed'
          });
        }
        
        return filePath;
        
      } catch (error) {
        attempt++;
        logger.error(`Download attempt ${attempt} failed for ${filename}: ${error}`);
        
        if (attempt >= this.retryLimit) {
          if (onProgress) {
            onProgress({
              url,
              filename,
              progress: 0,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    throw new Error(`Failed to download ${filename} after ${this.retryLimit} attempts`);
  }
}

export const downloader = new Downloader();
