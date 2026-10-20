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

const ALIASES = { uae: "United Arab Emirates", usa: "United States", us: "United States", "united states of america": "United States", uk: "United Kingdom", "great britain": "United Kingdom", england: "United Kingdom", ksa: "Saudi Arabia", "south korea": "South Korea", korea: "South Korea" };
const STATE_COUNTRY = {
  karnataka: "India", maharashtra: "India", haryana: "India", "uttar pradesh": "India", telangana: "India", "tamil nadu": "India", delhi: "India", "west bengal": "India", gujarat: "India", kerala: "India", rajasthan: "India", "andhra pradesh": "India",
  california: "United States", "new york": "United States", texas: "United States", washington: "United States", massachusetts: "United States", illinois: "United States", florida: "United States", colorado: "United States", georgia: "United States",
  ontario: "Canada", "british columbia": "Canada", quebec: "Canada", "new south wales": "Australia", victoria: "Australia",
};
const CITY_COUNTRY = new Map(COUNTRIES.flatMap((c) => c.cities.map((city) => [city.toLowerCase(), c.name])));
for (const [k, v] of Object.entries({ bangalore: "India", gurgaon: "India", "new delhi": "India", bombay: "India", "ncr": "India", "delhi ncr": "India", nyc: "United States", sf: "United States" })) CITY_COUNTRY.set(k, v);
const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c.name]));

/** @param {unknown} raw @returns {string} The posting's country, "Remote / worldwide", or "Not stated". */
export function countryOf(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s.trim()) return "Not stated";
  const parts = s.split(/[·,;|/()]+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  for (const p of [...parts].reverse()) {
    if (COUNTRY_NAMES.has(p)) return /** @type {string} */ (COUNTRY_NAMES.get(p));
    if (ALIASES[/** @type {keyof typeof ALIASES} */ (p)]) return ALIASES[/** @type {keyof typeof ALIASES} */ (p)];
  }
  for (const p of parts) {
    if (CITY_COUNTRY.has(p)) return /** @type {string} */ (CITY_COUNTRY.get(p));
    if (STATE_COUNTRY[/** @type {keyof typeof STATE_COUNTRY} */ (p)]) return STATE_COUNTRY[/** @type {keyof typeof STATE_COUNTRY} */ (p)];
  }
  if (/remote|anywhere|worldwide|global/.test(s)) return "Remote / worldwide";
  return "Other";
}

/** @param {unknown} text @returns {string} */
export function workModeOf(text) {
  const s = String(text || "").toLowerCase();
  if (/hybrid/.test(s)) return "Hybrid";
  if (/remote|work from home|wfh|anywhere/.test(s)) return "Remote";
  return "On-site or not stated";
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
