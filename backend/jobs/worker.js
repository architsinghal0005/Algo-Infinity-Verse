import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { analyzeWorkflow } from '../repository-analyzer/cicdValidator.js';
import { VCSFactory } from '../vcs/VCSFactory.js';
import { batchStore } from './queue.js';

// Use same Redis connection configuration
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) return null; 
    return Math.min(times * 50, 2000);
  }
});

// Configure the worker process
export const auditWorker = new Worker('bulk-audit-queue', async (job) => {
  const { batchId, repoUrl } = job.data;
  
  if (!repoUrl || !repoUrl.includes("github.com")) {
    throw new Error("Invalid GitHub URL");
  }

  try {
    // 1. Fetch workflows from GitHub
    const provider = VCSFactory.getProvider(repoUrl);
    const workflows = await provider.getNormalizedWorkflows();
    
    // 2. Analyze workflows
    let bestScore = 0;
    if (workflows.length > 0) {
      for (const wf of workflows) {
        const result = analyzeWorkflow(wf.commands);
        if (result.score > bestScore) bestScore = result.score;
      }
    }

    return { repoUrl, score: bestScore };

  } catch (error) {
    console.error(`Job ${job.id} failed for repo ${repoUrl}:`, error.message);
    throw error;
  }
}, {
  connection: redisConnection,
  concurrency: 5 // Process up to 5 jobs simultaneously
});

// Event listeners for tracking batch progress
auditWorker.on('completed', (job, result) => {
  const { batchId } = job.data;
  const batch = batchStore.get(batchId);
  if (batch) {
    batch.completed += 1;
    batch.results.push(result);
  }
});

auditWorker.on('failed', (job, err) => {
  const { batchId } = job.data;
  const batch = batchStore.get(batchId);
  if (batch) {
    batch.failed += 1;
    batch.results.push({ repoUrl: job.data.repoUrl, error: err.message, score: 0 });
  }
});

console.log('Background Audit Worker started and listening for jobs...');


