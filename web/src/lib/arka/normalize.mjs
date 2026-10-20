// Display normalisation for job data from many boards: one name per employer and one
// spelling per city, so facets and groupings don't split the same place or company.

const COMPANY_ALIASES = [
  [/^(asspl|adci|atspl|adsipl|aispl|amazon|aws\b|amazon web services|a2z|audible|amzn)/i, "Amazon"],
  [/^(google|alphabet|deepmind)\b/i, "Google"],
  [/^(microsoft|msft|linkedin)\b/i, "Microsoft"],
  [/^meta\b|^facebook\b/i, "Meta"],
  [/^flipkart\b/i, "Flipkart"],
];

/** @param {unknown} raw @returns {string} */
export function companyName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "Unknown company";
  for (const [re, name] of COMPANY_ALIASES) if (/** @type {RegExp} */ (re).test(s)) return /** @type {string} */ (name);
  // Drop legal-entity tails such as " - Karnataka - B56", " Pvt Ltd", " (India)".
  return s
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s*\((india|uae|emea|apac)\)\s*$/i, "")
    .replace(/[,\s]+(private limited|pvt\.? ltd\.?|limited|ltd\.?|llc|inc\.?|gmbh|fz-?llc|fze)$/i, "")
    .trim() || s;
}

const CITY_ALIASES = {
  bangalore: "Bengaluru", bengaluru: "Bengaluru", "bengaluru urban": "Bengaluru",
  gurgaon: "Gurugram", gurugram: "Gurugram", "new delhi": "Delhi", delhi: "Delhi", "delhi ncr": "Delhi NCR", ncr: "Delhi NCR",
  bombay: "Mumbai", mumbai: "Mumbai", "navi mumbai": "Navi Mumbai", madras: "Chennai", calcutta: "Kolkata",
  "noida": "Noida", "greater noida": "Noida", "hyderabad": "Hyderabad", "pune": "Pune",
  "dubai": "Dubai", "abu dhabi": "Abu Dhabi", "sharjah": "Sharjah",
  "new york city": "New York", nyc: "New York", "sf": "San Francisco", "bay area": "San Francisco Bay Area",
  "remote": "Remote", "anywhere": "Remote", "work from home": "Remote", wfh: "Remote",
};
const REGION_ONLY = new Set(["india", "in", "uae", "united arab emirates", "karnataka", "maharashtra", "haryana", "uttar pradesh", "telangana", "tamil nadu", "usa", "us", "united states", "uk", "united kingdom", "emea", "apac", "global", "multiple locations"]);
const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** The main city of a posting's location string, or its country when that's all it says. */
/** @param {unknown} raw @returns {string} */
export function cityName(raw) {
  const parts = String(raw || "").split(/[·,;|/()]+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "Not stated";
  for (const p of parts) {
    const k = p.toLowerCase().replace(/\s+/g, " ");
    if (CITY_ALIASES[k]) return CITY_ALIASES[k];
    if (/remote/i.test(k)) return "Remote";
    if (!REGION_ONLY.has(k) && !/^\d/.test(k) && k.length > 1) return title(p.toLowerCase());
  }
  const k = parts[0].toLowerCase();
  return k === "uae" || k === "united arab emirates" ? "UAE" : k === "in" || k === "india" ? "India" : title(parts[0]);
}

const SENIORITY = [
  ["C-level & VP", /\b(chief|cxo|ceo|coo|cfo|cro|cmo|cbo|vp|vice president|svp|evp|president)\b/i],
  ["Head & Director", /\b(head|director|gm|general manager)\b/i],
  ["Senior manager & lead", /\b(senior manager|sr\.? manager|lead|principal|staff)\b/i],
  ["Manager", /\bmanager\b/i],
];
export const SENIORITY_LEVELS = SENIORITY.map(([l]) => l);
/** Seniority band read from a job title; "Other" when the title doesn't say. */
/** @param {unknown} titleText @returns {string} */
export function seniorityOf(titleText) {
  for (const [label, re] of SENIORITY) if (/** @type {RegExp} */ (re).test(String(titleText || ""))) return /** @type {string} */ (label);
  return "Other";
}
