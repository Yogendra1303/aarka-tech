import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";

// Favourite companies and dismissed Explore results, kept in data/arka-explore.json.
// Removing a favourite only removes it here; jobs and applications for that company stay.
export type Favourite = { name: string; alerts: boolean; addedAt: string };
export type ExplorePrefs = { favourites: Favourite[]; prioritizeFavourites: boolean; dismissed: string[] };

const file = () => path.join(careerOpsRoot(), "data", "arka-explore.json");
const key = (s: string) => s.trim().toLowerCase();

export function readPrefs(): ExplorePrefs {
  try {
    const j = JSON.parse(fs.readFileSync(file(), "utf8"));
    return { favourites: Array.isArray(j.favourites) ? j.favourites : [], prioritizeFavourites: !!j.prioritizeFavourites, dismissed: Array.isArray(j.dismissed) ? j.dismissed : [] };
  } catch { return { favourites: [], prioritizeFavourites: false, dismissed: [] }; }
}
function write(p: ExplorePrefs) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
  fs.renameSync(tmp, file());
  return p;
}

export function updatePrefs(action: string, body: Record<string, unknown>): ExplorePrefs {
  const p = readPrefs();
  const name = String(body.name || "").trim().slice(0, 120);
  if (action === "add") {
    if (!name) throw new Error("Company name is required.");
    if (!p.favourites.some((f) => key(f.name) === key(name))) p.favourites.push({ name, alerts: true, addedAt: new Date().toISOString() });
  } else if (action === "remove") {
    p.favourites = p.favourites.filter((f) => key(f.name) !== key(name));
  } else if (action === "alerts") {
    const f = p.favourites.find((x) => key(x.name) === key(name)); if (!f) throw new Error("Not a favourite.");
    f.alerts = !!body.on;
  } else if (action === "prioritize") {
    p.prioritizeFavourites = !!body.on;
  } else if (action === "dismiss" || action === "undismiss") {
    const urls = (Array.isArray(body.urls) ? body.urls : [body.url]).map(String).filter((u) => /^https?:\/\//.test(u));
    const set = new Set(p.dismissed);
    for (const u of urls) action === "dismiss" ? set.add(u) : set.delete(u);
    p.dismissed = [...set].slice(-5000);
  } else throw new Error("Unknown action.");
  return write(p);
}
