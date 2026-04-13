import axios from "axios";

/**
 * =========================
 * SMART ADS.TXT CRAWLER
 * =========================
 * Now supports dynamic rule per URL
 */

/**
 * Parse rule string into clean searchable line
 * Example:
 * "adagio.io, 1370, RESELLER"
 */
function normalizeRule(rule = "") {
  return rule
    .split(",")
    .map(r => r.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * MAIN CRAWL FUNCTION
 */
export async function crawlUrl(url, rule = "") {
  try {
    const adsTxtUrl = url.replace(/\/$/, "") + "/ads.txt";

    const res = await axios.get(adsTxtUrl, {
      timeout: 10000
    });

    const content = res.data || "";

    const targetLine = normalizeRule(rule);

    const found = [];
    const missing = [];

    // If no rule provided → return safe fallback
    if (!targetLine) {
      return {
        url,
        adsTxtUrl,
        ok: true,
        found: [],
        missing: [],
        note: "No rule provided"
      };
    }

    /**
     * =========================
     * MATCHING LOGIC
     * =========================
     * We use "includes" for flexibility
     */
    if (content.includes(targetLine)) {
      found.push(targetLine);
    } else {
      missing.push(targetLine);
    }

    return {
      url,
      adsTxtUrl,
      ok: missing.length === 0,
      found,
      missing
    };

  } catch (err) {
    return {
      url,
      ok: false,
      error: err.message,
      found: [],
      missing: rule ? [rule] : []
    };
  }
}