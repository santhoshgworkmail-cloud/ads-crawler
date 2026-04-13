import axios from "axios";

// 👉 CHANGE THIS anytime you want different matching rules
const TARGET_LINES = [
  "adagio.io, 1370, RESELLER"
];

export async function crawlUrl(url) {
  try {
    const adsTxtUrl = url.replace(/\/$/, "") + "/ads.txt";

    const res = await axios.get(adsTxtUrl, {
      timeout: 10000
    });

    const content = res.data;

    const found = [];
    const missing = [];

    for (const line of TARGET_LINES) {
      if (content.includes(line)) {
        found.push(line);
      } else {
        missing.push(line);
      }
    }

    return {
      url,
      adsTxtUrl,
      ok: true,
      found,
      missing
    };
  } catch (err) {
    return {
      url,
      ok: false,
      error: err.message
    };
  }
}