import express from "express";
import multer from "multer";
import fs from "fs";
import { randomUUID } from "crypto";
import { startWorker } from "./worker.js";

const app = express();
app.use(express.json());

console.log("🔥 SERVER BOOTING...");

const jobs = new Map();

// file upload config
const upload = multer({ dest: "uploads/" });

/**
 * =========================
 * 🌐 UI DASHBOARD
 * =========================
 */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Ads Crawler</title>
  <style>
    body { font-family: Arial; max-width: 650px; margin: 40px auto; }
    button { padding: 10px; margin-top: 10px; cursor: pointer; }
    input { margin: 10px 0; }
    a { display:inline-block; margin-bottom:10px; }
    #status { margin-top: 20px; padding: 10px; background: #f4f4f4; }
  </style>
</head>
<body>

<h2>🚀 Ads.txt Crawler</h2>

<a href="/template">📥 Download Sample Template</a>

<br/>

<input type="file" id="file" />
<br />
<button onclick="upload()">Upload & Start Crawl</button>

<div id="status"></div>

<script>
let jobId = null;

async function upload() {
  const file = document.getElementById('file').files[0];

  if (!file) {
    alert("Please select a file first");
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  jobId = data.jobId;

  document.getElementById('status').innerHTML =
    "🚀 Job started: " + jobId;

  poll();
}

async function poll() {
  if (!jobId) return;

  const res = await fetch('/status/' + jobId);
  const data = await res.json();

  document.getElementById('status').innerHTML =
    "<b>Status:</b> " + data.status + "<br>" +
    "<b>Progress:</b> " + data.progress + "%<br>" +
    "<b>Done:</b> " + data.results.length + " | Failed: " + data.failed.length;

  if (data.status !== "completed") {
    setTimeout(poll, 2000);
  } else {
    document.getElementById('status').innerHTML +=
      "<br><br><a href='/download/" + jobId + "'>⬇ Download Results</a>";
  }
}
</script>

</body>
</html>
  `);
});

/**
 * =========================
 * TEMPLATE DOWNLOAD
 * =========================
 */
app.get("/template", (req, res) => {
  const csv =
`url,ads_txt_line
https://example.com,adagio.io, 1370, RESELLER
https://google.com,google.com, DIRECT
`;

  const filePath = "template.csv";
  fs.writeFileSync(filePath, csv);

  res.download(filePath);
});

/**
 * =========================
 * HEALTH CHECK
 * =========================
 */
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Ads crawler running" });
});

/**
 * =========================
 * UPLOAD CSV (URL + RULE)
 * =========================
 */
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    const filePath = req.file.path;
    const content = fs.readFileSync(filePath, "utf-8");

    const lines = content.split("\n").filter(Boolean);

    const urls = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");

      const url = parts[0]?.trim();
      const rule = parts.slice(1).join(",").trim(); // important fix

      if (url) {
        urls.push({ url, rule });
      }
    }

    const jobId = randomUUID();

    jobs.set(jobId, {
      id: jobId,
      urls,
      status: "queued",
      results: [],
      failed: [],
      progress: 0
    });

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
 * =========================
 * STATUS
 * =========================
 */
app.get("/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });

  res.json(job);
});

/**
 * =========================
 * DOWNLOAD CSV RESULT
 * =========================
 */
app.get("/download/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });

  const header = "url,rule,adsTxtUrl,status,found,missing,error\n";

  const rows = job.results.map(r => {
    return [
      r.url || "",
      r.rule || "",
      r.adsTxtUrl || "",
      r.ok ? "ok" : "failed",
      (r.found || []).join("|"),
      (r.missing || []).join("|"),
      r.error || ""
    ].join(",");
  });

  const csv = header + rows.join("\n");

  const filePath = `results/${req.params.id}.csv`;
  fs.writeFileSync(filePath, csv);

  res.download(filePath);
});

/**
 * =========================
 * RENDER SAFE PORT
 * =========================
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});