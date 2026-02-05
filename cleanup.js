// cleanup.js - Auto-cleanup for Summaro
const fs = require('fs');
const path = require('path');

// Configuration
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const MAX_STORAGE_MB = 300; // Adjust based on your server
const CLEANUP_INTERVAL_MINUTES = 30; // Run every hour

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function cleanupOldFiles() {
    console.log('🚀 Starting cleanup...');
    
    try {
        const files = fs.readdirSync(UPLOADS_DIR);
        let totalSize = 0;
        
        // Calculate current storage usage
        const fileStats = files.map(filename => {
            const filePath = path.join(UPLOADS_DIR, filename);
            const stats = fs.statSync(filePath);
            return {
                name: filename,
                path: filePath,
                size: stats.size,
                mtime: stats.mtimeMs
            };
        });
        
        // Total size in MB
        totalSize = fileStats.reduce((sum, file) => sum + file.size, 0);
        const totalSizeMB = totalSize / (1024 * 1024);
        
        console.log(`📊 Current storage: ${totalSizeMB.toFixed(2)}MB / ${MAX_STORAGE_MB}MB`);
        
        // If we're under the limit, do nothing
        if (totalSizeMB <= MAX_STORAGE_MB) {
            console.log('✅ Storage under limit, no cleanup needed');
            return;
        }
        
        // Sort files by oldest first (oldest = smallest mtime)
        fileStats.sort((a, b) => a.mtime - b.mtime);
        
        // Delete oldest files until we're at 80% capacity
        const targetSize = MAX_STORAGE_MB * 0.8 * 1024 * 1024; // 80% in bytes
        let deletedCount = 0;
        let currentTotal = totalSize;
        
        for (const file of fileStats) {
            if (currentTotal <= targetSize) break;
            
            try {
                fs.unlinkSync(file.path);
                currentTotal -= file.size;
                deletedCount++;
                console.log(`🗑️ Deleted: ${file.name} (${(file.size / (1024*1024)).toFixed(2)}MB)`);
            } catch (err) {
                console.error(`❌ Failed to delete ${file.name}:`, err.message);
            }
        }
        
        console.log(`✅ Cleanup complete. Deleted ${deletedCount} files. New size: ${(currentTotal/(1024*1024)).toFixed(2)}MB`);
        
    } catch (error) {
        console.error('❌ Cleanup error:', error.message);
    }
}

// Run immediately and then on interval
cleanupOldFiles();
setInterval(cleanupOldFiles, CLEANUP_INTERVAL_MINUTES * 60 * 1000);

// Export for manual triggering if needed
module.exports = { cleanupOldFiles };