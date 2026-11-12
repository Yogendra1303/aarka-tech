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
const SUFFIXES = ["international", "technologies", "technology", "solutions", "services", "service", "systems", "federal", "financial", "analytics", "consulting", "industries", "holdings", "partners", "security", "software", "logistics", "networks", "insurance", "capital", "digital", "global", "health", "energy", "ventures", "studios", "studio", "academy", "group", "labs", "media", "pharma", "foods", "motors", "retail", "cloud", "bank", "data", "inc"];
/** Split a run-together slug such as "accenturefederalservices" at known company words. */
function splitWords(/** @type {string} */ w) {
  /** @type {string[]} */ const tail = [];
  let rest = w;
  for (let guard = 0; guard < 4; guard++) {
    const suf = SUFFIXES.find((x) => rest.length > x.length + 2 && rest.endsWith(x));
    if (!suf) break;
    tail.unshift(suf); rest = rest.slice(0, -suf.length);
  }
  return [rest, ...tail];
}

/** @param {unknown} title @returns {string} A posting title without leading emoji or decoration. */
export function cleanTitle(title) {
  return String(title || "").replace(/^[\p{Extended_Pictographic}\uFE0F\s|•·*-]+/u, "").replace(/\s+/g, " ").trim();
}

export function companyName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "Unknown company";
  for (const [re, name] of COMPANY_ALIASES) if (/** @type {RegExp} */ (re).test(s)) return /** @type {string} */ (name);
  // Board slugs ("abinbev", "delivery-hero", "acs", "accenturefederalservices") become readable
  // names: short ones read as acronyms, and common company words are split off the end.
  if (/^[a-z0-9][a-z0-9_-]*$/.test(s)) {
    if (s.length <= 3) return s.toUpperCase();
    const words = s.split(/[-_]+/).flatMap(splitWords);
    return words.map((w) => (w.length <= 2 && words.length > 1 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");
  }
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
    // Skip work-mode words and short codes (IND, KA, NY) so the real city wins.
    if (/^(hybrid|on-?site|in[- ]office|office|flexible)$/.test(k) || k.length <= 3 || /\d/.test(k)) continue;
    if (!REGION_ONLY.has(k) && !/^\d/.test(k)) return title(p.toLowerCase());
  }
  const k = parts[0].toLowerCase();
  return k === "uae" || k === "united arab emirates" ? "UAE" : k === "in" || k === "india" ? "India" : title(parts[0]);
}

const SENIORITY = [
  ["Intern & entry level", /\b(intern|internship|trainee|graduate|apprentice|junior|jr\.?|entry[- ]level|fresher)\b/i],
  ["C-level & VP", /\b(chief|cxo|ceo|coo|cfo|cro|cmo|cbo|vp|vice president|svp|evp|president)\b/i],
  ["Head & Director", /\b(head|director|gm|general manager)\b/i],
  ["Senior manager & lead", /\b(senior manager|sr\.? manager|lead|principal|staff)\b/i],
  ["Manager", /\bmanager\b/i],
  ["Senior individual contributor", /\b(senior|sr\.?)\b/i],
  ["Individual contributor", /\b(specialist|executive|associate|analyst|engineer|developer|coordinator|representative|officer|consultant|designer|administrator|agent|advisor|partner|scientist|accountant|recruiter|writer)\b/i],
];
export const SENIORITY_LEVELS = SENIORITY.map(([l]) => l);
/** Seniority band read from a job title; "Not stated" when the title doesn't say. */
/** @param {unknown} titleText @returns {string} */
export function seniorityOf(titleText) {
  for (const [label, re] of SENIORITY) if (/** @type {RegExp} */ (re).test(String(titleText || ""))) return /** @type {string} */ (label);
  return "Not stated";
}
