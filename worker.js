import { crawlUrl } from "./crawler.js";

/**
 * =========================
 * START WORKER (CLEAN VERSION)
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

      // support both formats safely
      const url = typeof item === "string" ? item : item.url;
      const rule = typeof item === "string" ? "" : (item.rule || "");

      try {
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

        // FIXED: correct progress calculation (no duplication bug)
        const done = job.results.length + job.failed.length;
        job.progress = Math.round((done / job.urls.length) * 100);

      } catch (err) {
        const failedItem = {
          url,
          rule,
          ok: false,
          error: err.message
        };

        job.failed.push(failedItem);

        const done = job.results.length + job.failed.length;
        job.progress = Math.round((done / job.urls.length) * 100);
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
