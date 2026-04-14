import express from "express";
import multer from "multer";
import fs from "fs";
import { randomUUID } from "crypto";
import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

console.log("🔥 SERVER STARTED");

// -------------------- REDIS --------------------
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

// -------------------- QUEUE --------------------
const crawlQueue = new Queue("crawlQueue", { connection });
const queueEvents = new QueueEvents("crawlQueue", { connection });

// -------------------- STORAGE (simple tracking) --------------------
const jobs = new Map();

// -------------------- UPLOAD --------------------
const upload = multer({ dest: "uploads/" });

// -------------------- UI --------------------
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Crawler Queue SaaS</title>
<style>
body { font-family: Arial; max-width: 900px; margin: 30px auto; background:#f6f7fb; }
.card { background:white; padding:15px; margin:10px 0; border-radius:10px; }
button { padding:10px; background:#111; color:white; border:none; border-radius:8px; }
table { width:100%; background:white; border-collapse:collapse; }
th,td{padding:8px;border-bottom:1px solid #eee;font-size:13px;}
</style>
</head>
<body>

<div class="card">
<h3>🚀 Queue Crawler</h3>
</div>

<div class="card">
<input type="file" id="file"/>
<button onclick="upload()">Upload</button>
</div>

<div class="card">
<table>
<thead>
<tr><th>URL</th><th>Status</th></tr>
</thead>
<tbody id="table"></tbody>
</table>
</div>

<script>
let jobId = null;
let results = [];

async function upload(){
  const file = document.getElementById("file").files[0];
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/upload",{method:"POST",body:fd});
  const data = await res.json();
  jobId = data.jobId;

  poll();
}

async function poll(){
  const res = await fetch("/status/"+jobId);
  const data = await res.json();

  results = data.results || [];
  let html = "";

  results.forEach(r=>{
    html += "<tr><td>" + r.url + "</td><td>" + (r.ok ? "FOUND" : "MISSING") + "</td></tr>";
  });

  document.getElementById("table").innerHTML = html;

  if(data.status !== "completed"){
    setTimeout(poll, 2000);
  }
}
</script>

</body>
</html>
  `);
});

// -------------------- UPLOAD -> QUEUE --------------------
app.post("/upload", upload.single("file"), async (req, res) => {
  const content = fs.readFileSync(req.file.path, "utf-8");

  const urls = content
    .split("\n")
    .map(u => u.trim())
    .filter(Boolean);

  const jobId = randomUUID();

  jobs.set(jobId, {
    id: jobId,
    status: "queued",
    results: [],
    total: urls.length,
    done: 0
  });

  const targetLines = ["adagio.io, 1370, RESELLER"];

  // enqueue all URLs
  for (const url of urls) {
    await crawlQueue.add("crawl", {
      jobId,
      url,
      targetLines
    });
  }

  res.json({ jobId, total: urls.length });
});

// -------------------- RECEIVE RESULTS --------------------
queueEvents.on("completed", ({ jobId: bullJobId, returnvalue }) => {
  const data = returnvalue;
  if (!data) return;

  const job = jobs.get(data.jobId);
  if (!job) return;

  job.results.push(data);
  job.done++;

  if (job.done === job.total) {
    job.status = "completed";
  }

  jobs.set(data.jobId, job);
});

// -------------------- STATUS --------------------
app.get("/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).send("not found");
  res.json(job);
});

// -------------------- START --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 API running on port", PORT);
});
