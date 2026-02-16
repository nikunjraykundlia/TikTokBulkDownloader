class TikTokDownloader {
    constructor() {
        this.socket = io();
        this.currentSession = null;
        this.sessionResults = [];    // Accumulated results for this session
        this.sessionSummary = { total: 0, successful: 0, failed: 0 }; // Accumulated summary
        this.init();
    }

    init() {
        this.setupSocketListeners();
        this.setupEventListeners();
    }

    setupSocketListeners() {
        this.socket.on('download-complete', (data) => {
            this.handleBulkComplete(data);
        });

        this.socket.on('download-stopped', (data) => {
            this.handleDownloadStopped(data);
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

            const response = await fetch('/api/download/single', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Download completed successfully!', 'success');
                urlInput.value = '';
                
                // Accumulate result into session
                this.sessionResults.push({
                    url,
                    filename: result.filename,
                    downloadUrl: result.downloadUrl,
                    success: true,
                    videoInfo: result.videoInfo
                });

                // Update session summary
                this.sessionSummary.total += 1;
                this.sessionSummary.successful += 1;

                // Re-render accumulated results and summary
                this.renderSessionResults();
                this.renderSessionSummary();
                
                // Auto-download the file
                if (result.downloadUrl) {
                    this.downloadFile(result.downloadUrl, result.filename);
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Download failed:', error);

            // Accumulate failed result
            this.sessionResults.push({
                url,
                filename: 'Failed',
                success: false,
                error: error.message
            });

            // Update session summary
            this.sessionSummary.total += 1;
            this.sessionSummary.failed += 1;

            // Re-render
            this.renderSessionResults();
            this.renderSessionSummary();

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
                
                // Add stop button
                this.addStopButton();
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

    handleBulkComplete(data) {
        this.currentSession = null;
        
        // Re-enable download button
        const downloadBtn = document.querySelector('#bulk-tab .download-btn');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Start Bulk Download';
        
        // Remove stop button
        const stopBtn = document.getElementById('stop-download-btn');
        if (stopBtn) {
            stopBtn.remove();
        }
        
        // Accumulate results into session
        if (data.results && Array.isArray(data.results)) {
            data.results.forEach(result => {
                this.sessionResults.push(result);
            });
        }

        // Accumulate summary stats
        this.sessionSummary.total += data.total || 0;
        this.sessionSummary.successful += data.successful || 0;
        this.sessionSummary.failed += data.failed || 0;

        // Re-render accumulated results and summary
        this.renderSessionResults();
        this.renderSessionSummary();
        
        // Auto-download all successful files
        data.results.forEach(result => {
            if (result.success && result.downloadUrl) {
                setTimeout(() => {
                    this.downloadFile(result.downloadUrl, result.filename);
                }, data.results.indexOf(result) * 2000);
            }
        });
        
        // Show completion toast
        if (data.failed === 0) {
            this.showToast('All downloads completed successfully!', 'success');
        } else {
            this.showToast(`${data.successful} successful, ${data.failed} failed`, 'info');
        }
    }

    renderSessionSummary() {
        const summaryDiv = document.getElementById('summary');
        const s = this.sessionSummary;

        if (s.total === 0) {
            summaryDiv.style.display = 'none';
            return;
        }

        summaryDiv.innerHTML = `
            <h4>Download Summary</h4>
            <div class="summary-stats">
                <div class="stat-item">
                    <i class="fas fa-list" style="color: #6c757d;"></i>
                    <span>Total: ${s.total}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-check-circle" style="color: #28a745;"></i>
                    <span>Successful: ${s.successful}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-times-circle" style="color: #dc3545;"></i>
                    <span>Failed: ${s.failed}</span>
                </div>
            </div>
        `;
        summaryDiv.style.display = 'block';
    }

    renderSessionResults() {
        const resultsSection = document.getElementById('results-section');
        const resultsContainer = document.getElementById('results-container');
        
        resultsContainer.innerHTML = '';
        
        // Render all accumulated session results (newest first)
        const reversed = [...this.sessionResults].reverse();
        reversed.forEach((result, index) => {
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
                ${result.success && result.downloadUrl ? `
                    <div style="margin-top: 10px;">
                        <button onclick="app.downloadFile('${result.downloadUrl}', '${result.filename}')" 
                                class="download-btn" style="padding: 8px 16px; font-size: 0.9em;">
                            <i class="fas fa-download"></i> Download to Device
                        </button>
                    </div>
                ` : ''}
            `;
            resultsContainer.appendChild(resultItem);
        });
        
        resultsSection.style.display = this.sessionResults.length > 0 ? 'block' : 'none';
    }

    clearMemory() {
        this.sessionResults = [];
        this.sessionSummary = { total: 0, successful: 0, failed: 0 };

        // Clear UI
        document.getElementById('results-container').innerHTML = '';
        document.getElementById('summary').style.display = 'none';
        document.getElementById('summary').innerHTML = '';
        document.getElementById('results-section').style.display = 'none';

        this.showToast('Session memory cleared', 'info');
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

    downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    addStopButton() {
        const resultsSection = document.getElementById('results-section');
        const existingStopBtn = document.getElementById('stop-download-btn');
        
        if (!existingStopBtn) {
            const stopBtn = document.createElement('button');
            stopBtn.id = 'stop-download-btn';
            stopBtn.className = 'stop-btn';
            stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Download';
            stopBtn.style.cssText = `
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin: 10px 0;
                font-size: 14px;
            `;
            
            stopBtn.onclick = () => this.stopDownload();

            // Show results section if not visible (so stop button appears)
            resultsSection.style.display = 'block';
            resultsSection.appendChild(stopBtn);
        }
    }

    async stopDownload() {
        if (!this.currentSession) return;
        
        try {
            const response = await fetch(`/api/download/stop/${this.currentSession}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showToast('Download stopped successfully', 'warning');
            } else {
                throw new Error('Failed to stop download');
            }
        } catch (error) {
            this.showToast('Failed to stop download: ' + error.message, 'error');
        }
    }

    handleDownloadStopped(data) {
        if (data.sessionId === this.currentSession) {
            this.currentSession = null;
            
            // Re-enable download button
            const downloadBtn = document.querySelector('#bulk-tab .download-btn');
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Start Bulk Download';
            
            // Remove stop button
            const stopBtn = document.getElementById('stop-download-btn');
            if (stopBtn) {
                stopBtn.remove();
            }
            
            this.showToast('Download session stopped', 'info');
        }
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

function clearMemory() {
    app.clearMemory();
}

// Initialize the app
const app = new TikTokDownloader();
