import { chromium, Browser, Page } from 'playwright';
import { logger } from '../utils/logger';

export interface TikTokVideoInfo {
  directUrl: string;
  title?: string;
  author?: string;
  duration?: string;
}

export class TikTokService {
  private browser: Browser | null = null;
  private readonly serviceUrl: string;
  private readonly headless: boolean;
  private readonly timeout: number;

  constructor() {
    this.serviceUrl = process.env.DOWNLOAD_SERVICE || 'https://snaptik.app';
    this.headless = process.env.HEADLESS !== 'false';
    this.timeout = Number(process.env.SERVICE_TIMEOUT_MS) || 20000;
  }

  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ 
        headless: this.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async getDirectUrl(tiktokUrl: string): Promise<TikTokVideoInfo> {
    await this.init();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      logger.info(`Fetching direct URL for: ${tiktokUrl}`);
      
      // Navigate to the download service
      await page.goto(this.serviceUrl, { waitUntil: 'networkidle' });
      
      // Wait for the input field and fill it
      await page.waitForSelector('input[name="url"], input[type="url"], input[placeholder*="URL"]', { timeout: 10000 });
      const urlInput = await page.locator('input[name="url"], input[type="url"], input[placeholder*="URL"]').first();
      await urlInput.fill(tiktokUrl);
      
      // Find and click the submit button
      const submitButton = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Download")').first();
      await submitButton.click();
      
      // Wait for the download link to appear
      await page.waitForSelector('a[href$=".mp4"], a[href*="mp4"]', { timeout: this.timeout });
      
      // Get the direct download link
      const downloadLink = await page.locator('a[href$=".mp4"], a[href*="mp4"]').first();
      const directUrl = await downloadLink.getAttribute('href');
      
      if (!directUrl) {
        throw new Error('Direct MP4 link not found');
      }
      
      // Try to get additional metadata if available
      let title = '';
      let author = '';
      
      try {
        const titleElement = await page.locator('[class*="title"], [class*="video-title"], h1, h2, h3').first();
        title = await titleElement.textContent() || '';
      } catch (e) {
        // Title not found, continue
      }
      
      try {
        const authorElement = await page.locator('[class*="author"], [class*="username"], [class*="user"]').first();
        author = await authorElement.textContent() || '';
      } catch (e) {
        // Author not found, continue
      }
      
      logger.success(`Direct URL obtained: ${directUrl}`);
      
      return {
        directUrl,
        title: title.trim(),
        author: author.trim()
      };
      
    } catch (error) {
      logger.error(`Failed to get direct URL: ${error}`);
      throw error;
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const tiktokService = new TikTokService();
