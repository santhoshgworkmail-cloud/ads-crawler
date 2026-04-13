import { crawlUrl } from "./crawler.js";
import fs from "fs";

export async function startWorker(jobId, jobs) {
  const job = jobs.get(jobId);
  if (!job) return;

  console.log("🚀 Worker started:", jobId);

  job.status = "processing";

  for (const url of job.urls) {
    try {
      const result = await crawlUrl(url);
      job.results.push(result);
    } catch (err) {
      job.failed.push({ url, error: err.message });
    }

    job.progress = Math.round(
      ((job.results.length + job.failed.length) / job.urls.length) * 100
    );
  }

  job.status = "completed";

  // save result file
  fs.writeFileSync(
    `results/${jobId}.json`,
    JSON.stringify(job, null, 2)
  );

  console.log("🏁 Worker finished:", jobId);
}