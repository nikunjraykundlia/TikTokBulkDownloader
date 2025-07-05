class TikTokDownloader {
    constructor() {
        this.socket = io();
        this.currentSession = null;
        this.progressItems = new Map();
        this.init();
    }

    init() {
        this.setupSocketListeners();
        this.setupEventListeners();
    }

    setupSocketListeners() {
        this.socket.on('download-progress', (data) => {
            this.updateProgress(data);
        });

        this.socket.on('download-complete', (data) => {
            this.handleBulkComplete(data);
        });

        this.socket.on('download-error', (data) => {
            this.showToast('Download Error: ' + data.error, 'error');
        });
    }

    setupEventListeners() {
        // Handle Enter key in single URL input
        document.getElementById('single-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.downloadSingle();
            }
        });

        // Handle Ctrl+Enter in bulk textarea
        document.getElementById('bulk-urls').addEventListener('keypress', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.downloadBulk();
            }
        });
    }

    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(tabName + '-tab').classList.add('active');
        
        // Add active class to clicked button
        event.target.classList.add('active');
    }

    async downloadSingle() {
        const urlInput = document.getElementById('single-url');
        const url = urlInput.value.trim();
        
        if (!url) {
            this.showToast('Please enter a TikTok URL', 'error');
            return;
        }

        if (!this.isValidTikTokUrl(url)) {
            this.showToast('Please enter a valid TikTok URL', 'error');
            return;
        }

        const downloadBtn = document.querySelector('#single-tab .download-btn');
        const originalText = downloadBtn.innerHTML;
        
        try {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<div class="loading"></div> Downloading...';
            
            this.showProgressSection();
            this.addProgressItem({
                url,
                filename: 'Preparing...',
                status: 'fetching-url',
                progress: 0,
                index: 0
            });

            const response = await fetch('/api/download/single', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const result = await response.json();

            if (result.success) {
                this.updateProgress({
                    url,
                    filename: result.filename,
                    status: 'completed',
                    progress: 100,
                    index: 0
                });
                
                this.showToast('Download completed successfully!', 'success');
                urlInput.value = '';
                
                // Show download result
                this.showResults([{
                    url,
                    filename: result.filename,
                    success: true,
                    videoInfo: result.videoInfo
                }]);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Download failed:', error);
            this.updateProgress({
                url,
                filename: 'Failed',
                status: 'failed',
                progress: 0,
                error: error.message,
                index: 0
            });
            this.showToast('Download failed: ' + error.message, 'error');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }
    }

    async downloadBulk() {
        const textarea = document.getElementById('bulk-urls');
        const concurrencyInput = document.getElementById('concurrency');
        const urls = textarea.value.trim().split('\n').filter(url => url.trim());
        const concurrency = parseInt(concurrencyInput.value) || 3;
        
        if (urls.length === 0) {
            this.showToast('Please enter at least one TikTok URL', 'error');
            return;
        }

        // Validate URLs
        const invalidUrls = urls.filter(url => !this.isValidTikTokUrl(url));
        if (invalidUrls.length > 0) {
            this.showToast(`Invalid URLs found: ${invalidUrls.length}`, 'error');
            return;
        }

        const downloadBtn = document.querySelector('#bulk-tab .download-btn');
        const originalText = downloadBtn.innerHTML;
        
        try {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<div class="loading"></div> Starting...';
            
            this.showProgressSection();
            this.clearProgress();
            
            // Initialize progress items
            urls.forEach((url, index) => {
                this.addProgressItem({
                    url,
                    filename: 'Waiting...',
                    status: 'fetching-url',
                    progress: 0,
                    index
                });
            });

            const response = await fetch('/api/download/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ urls, concurrency })
            });

            const result = await response.json();

            if (result.success) {
                this.currentSession = result.sessionId;
                this.showToast(`Bulk download started (${urls.length} videos)`, 'info');
                downloadBtn.innerHTML = '<div class="loading"></div> Downloading...';
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Bulk download failed:', error);
            this.showToast('Bulk download failed: ' + error.message, 'error');
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }
    }

    updateProgress(data) {
        if (!data.url) return;

        const key = `${data.index}-${data.url}`;
        this.progressItems.set(key, data);

        const container = document.getElementById('progress-container');
        let item = container.querySelector(`[data-key="${key}"]`);

        if (!item) {
            item = this.createProgressItem(data);
            item.setAttribute('data-key', key);
            container.appendChild(item);
        }

        this.updateProgressItem(item, data);
    }

    createProgressItem(data) {
        const item = document.createElement('div');
        item.className = 'progress-item';
        item.innerHTML = `
            <div class="progress-header">
                <div class="progress-filename">${data.filename}</div>
                <div class="progress-status status-${data.status}">${this.getStatusText(data.status)}</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${data.progress}%"></div>
            </div>
            <div class="progress-text">${data.progress.toFixed(1)}%</div>
            ${data.error ? `<div class="error-message" style="color: #dc3545; margin-top: 5px; font-size: 0.9em;">${data.error}</div>` : ''}
        `;
        return item;
    }

    updateProgressItem(item, data) {
        const filename = item.querySelector('.progress-filename');
        const status = item.querySelector('.progress-status');
        const progressFill = item.querySelector('.progress-fill');
        const progressText = item.querySelector('.progress-text');
        
        filename.textContent = data.filename;
        status.textContent = this.getStatusText(data.status);
        status.className = `progress-status status-${data.status}`;
        progressFill.style.width = `${data.progress}%`;
        progressText.textContent = `${data.progress.toFixed(1)}%`;

        // Add error message if exists
        let errorDiv = item.querySelector('.error-message');
        if (data.error) {
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.style.cssText = 'color: #dc3545; margin-top: 5px; font-size: 0.9em;';
                item.appendChild(errorDiv);
            }
            errorDiv.textContent = data.error;
        } else if (errorDiv) {
            errorDiv.remove();
        }
    }

    getStatusText(status) {
        const statusMap = {
            'fetching-url': 'Fetching URL',
            'downloading': 'Downloading',
            'completed': 'Completed',
            'failed': 'Failed'
        };
        return statusMap[status] || status;
    }

    handleBulkComplete(data) {
        this.currentSession = null;
        
        // Re-enable download button
        const downloadBtn = document.querySelector('#bulk-tab .download-btn');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Start Bulk Download';
        
        // Show summary
        this.showSummary(data);
        
        // Show results
        this.showResults(data.results);
        
        // Show completion toast
        if (data.failed === 0) {
            this.showToast('All downloads completed successfully!', 'success');
        } else {
            this.showToast(`${data.successful} successful, ${data.failed} failed`, 'info');
        }
    }

    showSummary(data) {
        const summaryDiv = document.getElementById('summary');
        summaryDiv.innerHTML = `
            <h4>Download Summary</h4>
            <div class="summary-stats">
                <div class="stat-item">
                    <i class="fas fa-list" style="color: #6c757d;"></i>
                    <span>Total: ${data.total}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-check-circle" style="color: #28a745;"></i>
                    <span>Successful: ${data.successful}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-times-circle" style="color: #dc3545;"></i>
                    <span>Failed: ${data.failed}</span>
                </div>
            </div>
        `;
        summaryDiv.style.display = 'block';
    }

    showResults(results) {
        const resultsSection = document.getElementById('results-section');
        const resultsContainer = document.getElementById('results-container');
        
        resultsContainer.innerHTML = '';
        
        results.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'progress-item';
            resultItem.innerHTML = `
                <div class="progress-header">
                    <div class="progress-filename">${result.filename || 'Unknown'}</div>
                    <div class="progress-status status-${result.success ? 'completed' : 'failed'}">
                        ${result.success ? 'Success' : 'Failed'}
                    </div>
                </div>
                <div style="font-size: 0.9em; color: #6c757d; margin-top: 5px;">
                    ${result.url}
                </div>
                ${result.error ? `<div style="color: #dc3545; margin-top: 5px; font-size: 0.9em;">${result.error}</div>` : ''}
                ${result.videoInfo ? `<div style="color: #28a745; margin-top: 5px; font-size: 0.9em;">
                    ${result.videoInfo.title ? `Title: ${result.videoInfo.title}` : ''}
                    ${result.videoInfo.author ? ` | Author: ${result.videoInfo.author}` : ''}
                </div>` : ''}
            `;
            resultsContainer.appendChild(resultItem);
        });
        
        resultsSection.style.display = 'block';
    }

    showProgressSection() {
        document.getElementById('progress-section').style.display = 'block';
    }

    clearProgress() {
        document.getElementById('progress-container').innerHTML = '';
        document.getElementById('summary').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        this.progressItems.clear();
    }

    addProgressItem(data) {
        const key = `${data.index}-${data.url}`;
        this.progressItems.set(key, data);
        
        const container = document.getElementById('progress-container');
        const item = this.createProgressItem(data);
        item.setAttribute('data-key', key);
        container.appendChild(item);
    }

    isValidTikTokUrl(url) {
        const patterns = [
            /https?:\/\/(www\.)?tiktok\.com\/@[^\/]+\/video\/\d+/,
            /https?:\/\/vm\.tiktok\.com\/[A-Za-z0-9]+/,
            /https?:\/\/(www\.)?tiktok\.com\/t\/[A-Za-z0-9]+/,
            /https?:\/\/(www\.)?tiktok\.com\/v\/\d+/
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Global functions for tab switching
function showTab(tabName) {
    app.showTab(tabName);
}

function downloadSingle() {
    app.downloadSingle();
}

function downloadBulk() {
    app.downloadBulk();
}

// Initialize the app
const app = new TikTokDownloader();
