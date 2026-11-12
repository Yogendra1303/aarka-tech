// Pure helpers for "Add a Job": link validation, employer from link, stated facts from text.

/** Accept only public http(s) job links: no local, private or credentialed addresses. */
/** @param {string} raw @returns {{ok: true, url: string} | {ok: false, error: string}} */
export function validateUrl(raw) {
  let u;
  try { u = new URL(raw.trim()); } catch { return { ok: false, error: "That doesn't look like a web address. Paste the full link, starting with https://" }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, error: "Only http and https job links can be read." };
  if (u.username || u.password) return { ok: false, error: "Links with a username or password can't be used." };
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "[::1]" || !h.includes("."))
    return { ok: false, error: "That address points to this computer or a private network, so it can't be read." };
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k);
  return { ok: true, url: u.toString() };
}

const title = (/** @type {string} */ s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
/** @param {string} raw @returns {string} */
export function companyFromUrl(raw) {
  try {
    const u = new URL(raw); const h = u.hostname.toLowerCase(); const seg = u.pathname.split("/").filter(Boolean);
    if (/greenhouse\.io$|lever\.co$|ashbyhq\.com$|smartrecruiters\.com$|workable\.com$|recruitee\.com$/.test(h) && seg[0] && !/^(embed|jobs|j)$/.test(seg[0])) return title(seg[0]);
    const wd = h.match(/^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/); if (wd) return title(wd[1]);
    const parts = h.replace(/^(www|careers|jobs|apply|boards)\./, "").split(".");
    return title(parts.length > 1 ? parts[parts.length - 2] : parts[0]);
  } catch { return ""; }
}

// Reads stated facts out of the description text; returns "" when the text doesn't say.
/** @param {string} text */
export function extractFacts(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const loc = lines.find((l) => /^location\s*:/i.test(l))?.replace(/^location\s*:\s*/i, "") || "";
  const workModel = lines.find((l) => /^work model\s*:/i.test(l))?.replace(/^work model\s*:\s*/i, "") || "";
  const type = (text.match(/\b(full[- ]time|part[- ]time|contract(or)?|internship|temporary|fixed[- ]term|freelance)\b/i)?.[1] || "").replace(/^\w/, (c) => c.toUpperCase());
  const salary = text.match(/(?:salary|compensation|pay range|ctc|package)[^\n]{0,40}?((?:₹|\$|€|£|aed|inr|usd|eur|gbp)\s?[\d.,]+\s?(?:k|lpa|lakh|cr|m)?(?:\s?[-–to]+\s?(?:₹|\$|€|£|aed|inr|usd|eur|gbp)?\s?[\d.,]+\s?(?:k|lpa|lakh|cr|m)?)?(?:\s?(?:per|\/)\s?(?:year|annum|month|hour|yr|mo))?)/i)?.[1] || "";
  // Bullet lines under a requirements-style heading.
  /** @type {string[]} */ const reqs = []; let inReq = false;
  for (const l of lines) {
    if (/^(requirements|qualifications|what you('| wi)ll (need|bring)|who you are|must have|minimum qualifications|what we('| a)re looking for|skills)\b/i.test(l.replace(/[#*:]/g, "").trim())) { inReq = true; continue; }
    if (inReq && /^(about|benefits|what we offer|why join|perks|responsibilities|what you('| wi)ll do|the role)\b/i.test(l.replace(/[#*:]/g, "").trim())) inReq = false;
    if (inReq && l.length > 8 && l.length < 300 && !/:\s*$/.test(l)) { const r = l.replace(/^(?:[-•*·]\s*|\d+[.)]\s+)/, ""); if (!reqs.includes(r)) reqs.push(r); }
    if (reqs.length >= 15) break;
  }
  return { location: [loc, workModel].filter(Boolean).join(" · "), employmentType: type, salary: salary.trim(), requirements: reqs };
}

