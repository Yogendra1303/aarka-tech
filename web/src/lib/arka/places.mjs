// Countries and their main cities, used for location suggestions, the country → city picker
// and for reading a posting's country. Any other place can still be typed in.
export const COUNTRIES = [
  { name: "India", cities: ["Gurugram", "Delhi", "Noida", "Bengaluru", "Mumbai", "Navi Mumbai", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Chandigarh", "Kochi", "Indore", "Coimbatore", "Lucknow"] },
  { name: "United Arab Emirates", cities: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"] },
  { name: "Saudi Arabia", cities: ["Riyadh", "Jeddah", "Dammam"] },
  { name: "Qatar", cities: ["Doha"] }, { name: "Bahrain", cities: ["Manama"] }, { name: "Oman", cities: ["Muscat"] }, { name: "Kuwait", cities: ["Kuwait City"] },
  { name: "Israel", cities: ["Tel Aviv", "Jerusalem"] }, { name: "Turkey", cities: ["Istanbul", "Ankara"] }, { name: "Egypt", cities: ["Cairo"] },
  { name: "Singapore", cities: ["Singapore"] }, { name: "Malaysia", cities: ["Kuala Lumpur", "Penang"] }, { name: "Indonesia", cities: ["Jakarta", "Bali"] },
  { name: "Philippines", cities: ["Manila", "Cebu"] }, { name: "Vietnam", cities: ["Ho Chi Minh City", "Hanoi"] }, { name: "Thailand", cities: ["Bangkok"] },
  { name: "Hong Kong", cities: ["Hong Kong"] }, { name: "Japan", cities: ["Tokyo", "Osaka"] }, { name: "South Korea", cities: ["Seoul"] },
  { name: "China", cities: ["Shanghai", "Beijing", "Shenzhen"] }, { name: "Taiwan", cities: ["Taipei"] },
  { name: "Australia", cities: ["Sydney", "Melbourne", "Brisbane", "Perth"] }, { name: "New Zealand", cities: ["Auckland", "Wellington"] },
  { name: "Sri Lanka", cities: ["Colombo"] }, { name: "Bangladesh", cities: ["Dhaka"] }, { name: "Pakistan", cities: ["Karachi", "Lahore"] }, { name: "Nepal", cities: ["Kathmandu"] },
  { name: "United Kingdom", cities: ["London", "Manchester", "Edinburgh", "Birmingham", "Cambridge"] }, { name: "Ireland", cities: ["Dublin"] },
  { name: "Germany", cities: ["Berlin", "Munich", "Hamburg", "Frankfurt"] }, { name: "France", cities: ["Paris", "Lyon"] }, { name: "Netherlands", cities: ["Amsterdam", "Rotterdam"] },
  { name: "Spain", cities: ["Madrid", "Barcelona"] }, { name: "Portugal", cities: ["Lisbon", "Porto"] }, { name: "Italy", cities: ["Milan", "Rome"] },
  { name: "Switzerland", cities: ["Zurich", "Geneva"] }, { name: "Sweden", cities: ["Stockholm"] }, { name: "Denmark", cities: ["Copenhagen"] }, { name: "Norway", cities: ["Oslo"] },
  { name: "Finland", cities: ["Helsinki"] }, { name: "Poland", cities: ["Warsaw", "Krakow"] }, { name: "Czech Republic", cities: ["Prague"] }, { name: "Belgium", cities: ["Brussels"] },
  { name: "Austria", cities: ["Vienna"] }, { name: "Estonia", cities: ["Tallinn"] }, { name: "Romania", cities: ["Bucharest"] }, { name: "Greece", cities: ["Athens"] },
  { name: "United States", cities: ["New York", "San Francisco", "Seattle", "Austin", "Boston", "Chicago", "Los Angeles", "Miami", "Denver", "Atlanta", "Washington"] },
  { name: "Canada", cities: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"] }, { name: "Mexico", cities: ["Mexico City", "Guadalajara"] },
  { name: "Brazil", cities: ["São Paulo", "Rio de Janeiro"] }, { name: "Argentina", cities: ["Buenos Aires"] }, { name: "Colombia", cities: ["Bogotá", "Medellín"] }, { name: "Chile", cities: ["Santiago"] },
  { name: "South Africa", cities: ["Cape Town", "Johannesburg"] }, { name: "Nigeria", cities: ["Lagos"] }, { name: "Kenya", cities: ["Nairobi"] }, { name: "Morocco", cities: ["Casablanca"] },
];

const ALIASES = { uae: "United Arab Emirates", usa: "United States", us: "United States", "u.s.": "United States", "united states of america": "United States", uk: "United Kingdom", "great britain": "United Kingdom", england: "United Kingdom", scotland: "United Kingdom", wales: "United Kingdom", ksa: "Saudi Arabia", korea: "South Korea", "republic of korea": "South Korea", czechia: "Czech Republic", "türkiye": "Turkey", turkiye: "Turkey", holland: "Netherlands", "the netherlands": "Netherlands", "hong kong sar": "Hong Kong", "russian federation": "Russia", "viet nam": "Vietnam", "deutschland": "Germany", "españa": "Spain", "méxico": "Mexico", "brasil": "Brazil", "polska": "Poland", "österreich": "Austria", "schweiz": "Switzerland", "suisse": "Switzerland", "italia": "Italy", "magyarország": "Hungary", "україна": "Ukraine" };
const US_STATES = { al: 1, ak: 1, az: 1, ar: 1, ca: 1, co: 1, ct: 1, de: 1, fl: 1, ga: 1, hi: 1, id: 1, il: 1, ia: 1, ks: 1, ky: 1, la: 1, me: 1, md: 1, ma: 1, mi: 1, mn: 1, ms: 1, mo: 1, mt: 1, ne: 1, nv: 1, nh: 1, nj: 1, nm: 1, ny: 1, nc: 1, nd: 1, oh: 1, ok: 1, or: 1, pa: 1, ri: 1, sc: 1, sd: 1, tn: 1, tx: 1, ut: 1, vt: 1, va: 1, wa: 1, wv: 1, wi: 1, wy: 1, dc: 1 };
const STATE_COUNTRY = {
  karnataka: "India", maharashtra: "India", haryana: "India", "uttar pradesh": "India", telangana: "India", "tamil nadu": "India", "west bengal": "India", gujarat: "India", kerala: "India", rajasthan: "India", "andhra pradesh": "India", punjab: "India", "madhya pradesh": "India", odisha: "India",
  alabama: "United States", alaska: "United States", arizona: "United States", arkansas: "United States", california: "United States", colorado: "United States", connecticut: "United States", delaware: "United States", florida: "United States", georgia: "United States", hawaii: "United States", idaho: "United States", illinois: "United States", indiana: "United States", iowa: "United States", kansas: "United States", kentucky: "United States", louisiana: "United States", maine: "United States", maryland: "United States", massachusetts: "United States", michigan: "United States", minnesota: "United States", mississippi: "United States", missouri: "United States", montana: "United States", nebraska: "United States", nevada: "United States", "new hampshire": "United States", "new jersey": "United States", "new mexico": "United States", "new york": "United States", "north carolina": "United States", "north dakota": "United States", ohio: "United States", oklahoma: "United States", oregon: "United States", pennsylvania: "United States", "rhode island": "United States", "south carolina": "United States", "south dakota": "United States", tennessee: "United States", texas: "United States", utah: "United States", vermont: "United States", virginia: "United States", washington: "United States", "west virginia": "United States", wisconsin: "United States", wyoming: "United States",
  ontario: "Canada", "british columbia": "Canada", quebec: "Canada", alberta: "Canada", "new south wales": "Australia", victoria: "Australia", queensland: "Australia", bavaria: "Germany", "île-de-france": "France", catalonia: "Spain",
};
const EXTRA_CITIES = { prishtina: "Kosovo", pristina: "Kosovo", philadelphia: "United States", bremen: "Germany", praha: "Czech Republic", prague: "Czech Republic", brno: "Czech Republic", budapest: "Hungary", kyiv: "Ukraine", kiev: "Ukraine", lviv: "Ukraine", bucharest: "Romania", sofia: "Bulgaria", belgrade: "Serbia", zagreb: "Croatia", vilnius: "Lithuania", riga: "Latvia", tallinn: "Estonia", istanbul: "Turkey", rochester: "United States", "buenos aires": "Argentina", "são paulo": "Brazil", "sao paulo": "Brazil", lima: "Peru", montevideo: "Uruguay", "santo domingo": "Dominican Republic", "panama city": "Panama", "san josé": "Costa Rica", "san jose, costa rica": "Costa Rica", "kuala lumpur": "Malaysia", "makati": "Philippines", "taguig": "Philippines", "hanoi": "Vietnam", "karachi": "Pakistan", "lahore": "Pakistan", "dhaka": "Bangladesh", "colombo": "Sri Lanka", "kathmandu": "Nepal", "cairo": "Egypt", "lagos": "Nigeria", "nairobi": "Kenya", "accra": "Ghana", "johannesburg": "South Africa", "cape town": "South Africa", "casablanca": "Morocco", "tunis": "Tunisia", "amman": "Jordan", "beirut": "Lebanon", "dubai": "United Arab Emirates", "abu dhabi": "United Arab Emirates", "berlin": "Germany", "munich": "Germany", "münchen": "Germany", "hamburg": "Germany", "vienna": "Austria", "wien": "Austria", "zurich": "Switzerland", "zürich": "Switzerland", "milano": "Italy", "roma": "Italy", "lisboa": "Portugal", "warszawa": "Poland", "kraków": "Poland", "gurgaon": "India", "bangalore": "India", "new delhi": "India", "bombay": "India", "ncr": "India", "delhi ncr": "India", "nyc": "United States", "sf": "United States", "bay area": "United States" };
const CITY_COUNTRY = new Map([...COUNTRIES.flatMap((c) => c.cities.map((city) => [city.toLowerCase(), c.name])), ...Object.entries(EXTRA_CITIES)]);
// Every ISO country name the runtime knows, so a stated country is never "unknown".
const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c.name]));
const ISO = new Map();
try {
  const dn = new Intl.DisplayNames(["en"], { type: "region" });
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b); let name; try { name = dn.of(code); } catch { continue; }
    if (name && name !== code && !/unknown/i.test(name)) { ISO.set(code.toLowerCase(), name); if (!COUNTRY_NAMES.has(name.toLowerCase())) COUNTRY_NAMES.set(name.toLowerCase(), name); }
  }
} catch { /* runtime without Intl.DisplayNames: the lists above still apply */ }
for (const [k, v] of [["czechia", "Czech Republic"], ["türkiye", "Turkey"]]) COUNTRY_NAMES.set(k, v);
const canon = (/** @type {string} */ n) => ({ "Czechia": "Czech Republic", "Türkiye": "Turkey", "United States of America": "United States", "Hong Kong SAR China": "Hong Kong" })[n] || n;
export const UNKNOWN_COUNTRY = "Unknown / not specified";

/** @param {unknown} raw @returns {string} The posting's country, "Remote / worldwide", or "Unknown / not specified". */
export function countryOf(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return UNKNOWN_COUNTRY;
  const parts = s.split(/[·,;|/()]+|\s+-\s+|\s+–\s+/).map((p) => p.trim()).filter(Boolean);
  for (const p of [...parts].reverse()) {
    if (COUNTRY_NAMES.has(p)) return canon(/** @type {string} */ (COUNTRY_NAMES.get(p)));
    if (ALIASES[/** @type {keyof typeof ALIASES} */ (p)]) return ALIASES[/** @type {keyof typeof ALIASES} */ (p)];
  }
  for (const p of parts) {
    if (CITY_COUNTRY.has(p)) return /** @type {string} */ (CITY_COUNTRY.get(p));
    if (STATE_COUNTRY[/** @type {keyof typeof STATE_COUNTRY} */ (p)]) return STATE_COUNTRY[/** @type {keyof typeof STATE_COUNTRY} */ (p)];
  }
  // "Austin, TX" style: a US state code after a comma.
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && last.length === 2 && US_STATES[/** @type {keyof typeof US_STATES} */ (last)]) return "United States";
  // A trailing ISO code such as ", DE" or ", IN" (only when it's the last part and there are 2+ parts).
  if (parts.length >= 2 && last.length === 2 && ISO.has(last)) return canon(ISO.get(last));
  // Last pass: a country, state or known city named anywhere as whole words
  // ("Czechia Praha", "FL-ACG Florida AOB", "PA - Philadelphia").
  const padded = ` ${s.replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const hit = (/** @type {Iterable<[string, string]>} */ entries) => { let best = ""; let val = ""; for (const [k, v] of entries) if (k.length > best.length && k.length > 3 && padded.includes(` ${k} `)) { best = k; val = v; } return val; };
  const byCountry = hit(COUNTRY_NAMES.entries()); if (byCountry) return canon(byCountry);
  const byState = hit(Object.entries(STATE_COUNTRY)); if (byState) return byState;
  const byCity = hit(CITY_COUNTRY.entries()); if (byCity) return byCity;
  const first = parts[0]; if (first && first.length === 2 && US_STATES[/** @type {keyof typeof US_STATES} */ (first)] && /\s-\s/.test(s)) return "United States";
  if (/remote|anywhere|worldwide|global/.test(s)) return "Remote / worldwide";
  return UNKNOWN_COUNTRY;
}

/** @param {unknown} text @returns {string} */
export function workModeOf(text) {
  const s = String(text || "").toLowerCase();
  if (/hybrid/.test(s)) return "Hybrid";
  if (/remote|work from home|wfh|anywhere/.test(s)) return "Remote";
  if (/on-?site|in[- ]office|office[- ]based|in person|work from office|\bwfo\b/.test(s)) return "On-site";
  return "Not stated";
}

/** @param {unknown} name @returns {boolean} Whether this is a city we know (not a site name like "Store 332"). */
export function isKnownCity(name) {
  return CITY_COUNTRY.has(String(name || "").toLowerCase());
}

/** @param {unknown} text @returns {string} */
export function employmentTypeOf(text) {
  const s = String(text || "").toLowerCase();
  if (/\bintern(ship)?\b|trainee|apprentice/.test(s)) return "Internship";
  if (/\bcontract(or)?\b|freelance|temporary|\btemp\b|fixed[- ]term/.test(s)) return "Contract";
  if (/part[- ]time/.test(s)) return "Part-time";
  return "Full-time or not stated";
}

export const PLACES = ["Remote", ...COUNTRIES.flatMap((c) => [c.name, ...c.cities])];

export const ROLE_SUGGESTIONS = [
  "Operations", "Business Operations", "Strategy & Operations", "General Manager", "Chief of Staff", "Chief Operating Officer",
  "Customer Success", "Customer Experience", "Customer Support", "Growth", "Go-to-Market", "Revenue Operations", "Sales", "Business Development",
  "Partnerships", "Account Manager", "Account Executive", "Category Manager", "Program Manager", "Project Manager", "Product Manager", "Product Operations",
  "Marketing", "Performance Marketing", "Content", "Brand Manager", "Supply Chain", "Logistics", "Procurement", "Finance", "FP&A", "Accountant",
  "Business Analyst", "Data Analyst", "Data Scientist", "Software Engineer", "Frontend Engineer", "Backend Engineer", "Engineering Manager", "QA Engineer",
  "DevOps", "Designer", "UX Researcher", "HR Business Partner", "Recruiter", "Talent Acquisition", "Legal Counsel", "Country Manager", "Regional Manager",
  "City Head", "Business Head", "Founder's Office", "Consultant", "Graduate", "Intern",
];
