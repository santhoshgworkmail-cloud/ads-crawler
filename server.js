import express from "express";
import multer from "multer";
import fs from "fs";
import { randomUUID } from "crypto";
import { startWorker } from "./worker.js";

const app = express();
app.use(express.json());

console.log("🔥 SERVER BOOTING...");

// In-memory jobs (OK for MVP; later we upgrade to Redis)
const jobs = new Map();

// file upload setup
const upload = multer({ dest: "uploads/" });

/**
 * HEALTH CHECK
 */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Ads crawler running"
  });
});

/**
 * UPLOAD FILE (URLs list)
 */
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    const filePath = req.file.path;
    const content = fs.readFileSync(filePath, "utf-8");

    const urls = content
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    const jobId = randomUUID();

    jobs.set(jobId, {
      id: jobId,
      urls,
      status: "queued",
      results: [],
      failed: [],
      progress: 0
    });

    // start background worker
    setImmediate(() => {
      startWorker(jobId, jobs);
    });

    res.json({
      jobId,
      totalUrls: urls.length,
      status: "queued"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * STATUS
 */
app.get("/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });

  res.json(job);
});

/**
 * DOWNLOAD RESULT
 */
app.get("/download/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });

  const filePath = `results/${req.params.id}.json`;
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2));

  res.download(filePath);
});

/**
 * RENDER SAFE PORT FIX (IMPORTANT)
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});