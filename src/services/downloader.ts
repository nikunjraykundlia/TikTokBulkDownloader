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
    
    // Add delay before starting download to prevent server overload
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
        
        // Validate file size after download
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;
        
        // Check if file is too small (likely corrupted or empty)
        if (fileSize < 1024) { // Less than 1KB
          throw new Error(`Downloaded file is too small (${fileSize} bytes), likely corrupted`);
        }
        
        logger.success(`Downloaded: ${filename} (${Math.round(fileSize/1024)}KB)`);
        
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
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class Downloader {
  private readonly outputDir: string;
  private readonly retryLimit: number;

  constructor() {
    this.outputDir = process.env.OUTPUT_DIR || 'downloads';
    this.retryLimit = Number(process.env.RETRY_LIMIT) || 3;
    this.ensureOutputDir();
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create output directory: ${error}`);
    }
  }

  async downloadFile(url: string, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    const filePath = path.join(this.outputDir, filename);
    let attempt = 0;

    while (attempt < this.retryLimit) {
      try {
        logger.info(`Downloading ${filename} (attempt ${attempt + 1})`);
        
        const response = await axios({
          url,
          method: 'GET',
          responseType: 'stream',
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const totalLength = parseInt(response.headers['content-length'] || '0');
        let downloadedLength = 0;

        const writer = require('fs').createWriteStream(filePath);
        
        response.data.on('data', (chunk: Buffer) => {
          downloadedLength += chunk.length;
          if (onProgress && totalLength > 0) {
            const progress = Math.round((downloadedLength / totalLength) * 100);
            onProgress(progress);
          }
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            logger.success(`Downloaded: ${filename}`);
            resolve(filePath);
          });
          writer.on('error', reject);
        });

      } catch (error) {
        attempt++;
        logger.warn(`Download attempt ${attempt} failed for ${filename}: ${error}`);
        
        if (attempt >= this.retryLimit) {
          throw new Error(`Failed to download ${filename} after ${this.retryLimit} attempts`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error(`Download failed after ${this.retryLimit} attempts`);
  }
}

export const downloader = new Downloader();
