import { crawlUrl } from "./crawler.js";

/**
 * =========================
 * START WORKER
 * =========================
 */
export async function startWorker(jobId, jobs) {
  const job = jobs.get(jobId);
  if (!job) return;

  console.log("🚀 Worker started:", jobId);

  job.status = "processing";

  const concurrency = 5;
  let index = 0;

  /**
   * =========================
   * WORKER LOOP
   * =========================
   */
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= job.urls.length) break;

      const item = job.urls[i];

      const url = item.url;
      const rule = item.rule || "";

      try {
        // 🔥 PASS RULE INTO CRAWLER
        const result = await crawlUrl(url, rule);

        const enriched = {
          url,
          rule,
          ...result
        };

        if (result.ok) {
          job.results.push(enriched);
        } else {
          job.failed.push(enriched);
        }

        // update progress
        job.progress = Math.round(
          ((job.results.length + job.failed.length) / job.urls.length) * 100
        );
      } catch (err) {
        job.failed.push({
          url,
          rule,
          ok: false,
          error: err.message
        });
      }
    }
  }

  // run workers in parallel
  await Promise.all(
    Array.from({ length: concurrency }, () => worker())
  );

  job.status = "completed";

  console.log("✅ Worker finished:", jobId);
}