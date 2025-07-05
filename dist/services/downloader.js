"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloader = exports.Downloader = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = require("fs");
const fs_2 = require("fs");
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
class Downloader {
    outputDir;
    retryLimit;
    constructor() {
        this.outputDir = process.env.OUTPUT_DIR || 'downloads';
        this.retryLimit = Number(process.env.RETRY_LIMIT) || 3;
    }
    async ensureOutputDir() {
        await fs_2.promises.mkdir(this.outputDir, { recursive: true });
    }
    async downloadFile(url, filename, onProgress) {
        await this.ensureOutputDir();
        const filePath = path_1.default.join(this.outputDir, filename);
        let attempt = 0;
        // Add delay before starting download to prevent server overload
        await new Promise(resolve => setTimeout(resolve, 1000));
        while (attempt < this.retryLimit) {
            try {
                logger_1.logger.info(`Downloading ${filename} (attempt ${attempt + 1}/${this.retryLimit})`);
                const response = await axios_1.default.get(url, {
                    responseType: 'stream',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;
                const writer = (0, fs_1.createWriteStream)(filePath);
                response.data.on('data', (chunk) => {
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
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    response.data.on('error', reject);
                });
                // Validate file size after download
                const stats = await fs_2.promises.stat(filePath);
                const fileSize = stats.size;
                // Check if file is too small (likely corrupted or empty)
                if (fileSize < 1024) { // Less than 1KB
                    throw new Error(`Downloaded file is too small (${fileSize} bytes), likely corrupted`);
                }
                logger_1.logger.success(`Downloaded: ${filename} (${Math.round(fileSize / 1024)}KB)`);
                if (onProgress) {
                    onProgress({
                        url,
                        filename,
                        progress: 100,
                        status: 'completed'
                    });
                }
                return filePath;
            }
            catch (error) {
                attempt++;
                logger_1.logger.error(`Download attempt ${attempt} failed for ${filename}: ${error}`);
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
exports.Downloader = Downloader;
exports.downloader = new Downloader();
