import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Optional: You can configure REDIS_URL in your environment.
// For local development without Redis, we will gracefully handle connection errors.
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    // Stop retrying after 3 attempts if Redis is not running locally to avoid log spam
    if (times > 3) {
      console.warn('Could not connect to Redis. Bulk audit features require Redis to be running.');
      return null; 
    }
    return Math.min(times * 50, 2000);
  }
});

// Create the shared queue instance
export const bulkAuditQueue = new Queue('bulk-audit-queue', {
  connection: redisConnection
});

// A simple in-memory store to track batch progress
// In a real production app, this would be stored in Redis or a DB.
export const batchStore = new Map();

/**
 * Enqueues a batch of repositories for analysis.
 * @param {string} batchId - Unique ID for this batch.
 * @param {Array<string>} repoUrls - Array of repository URLs.
 */
export async function enqueueBulkAudit(batchId, repoUrls) {
  batchStore.set(batchId, {
    total: repoUrls.length,
    completed: 0,
    failed: 0,
    results: [],
    status: 'processing'
  });

  const jobs = repoUrls.map((url, index) => ({
    name: `audit-${batchId}-${index}`,
    data: { batchId, repoUrl: url }
  }));

  try {
    // Add jobs in bulk to Redis
    await bulkAuditQueue.addBulk(jobs);
  } catch (err) {
    console.warn("Redis connection failed. Falling back to in-memory processing for simulation.");
    // Simulate background processing for testing environments without Redis
    setTimeout(async () => {
      const { analyzeWorkflow } = await import('../repository-analyzer/cicdValidator.js');
      const { VCSFactory } = await import('../vcs/VCSFactory.js');
      for (const url of repoUrls) {
        try {
          const provider = VCSFactory.getProvider(url);
          const workflows = await provider.getNormalizedWorkflows();
          let bestScore = 0;
          for (const wf of workflows) {
            const result = analyzeWorkflow(wf.commands);
            if (result.score > bestScore) bestScore = result.score;
          }
          const batch = batchStore.get(batchId);
          if (batch) {
            batch.completed += 1;
            batch.results.push({ repoUrl: url, score: bestScore });
          }
        } catch (jobErr) {
          const batch = batchStore.get(batchId);
          if (batch) {
            batch.failed += 1;
            batch.results.push({ repoUrl: url, error: jobErr.message, score: 0 });
          }
        }
      }
    }, 1000);
  }
}

/**
 * Gets the current progress of a batch.
 */
export function getBatchProgress(batchId) {
  const batch = batchStore.get(batchId);
  if (!batch) return null;
  
  const totalProcessed = batch.completed + batch.failed;
  const progress = batch.total > 0 ? Math.round((totalProcessed / batch.total) * 100) : 0;
  
  if (progress === 100) {
    batch.status = 'completed';
  }

  return {
    ...batch,
    progress
  };
}


