import { test } from "node:test";
import assert from "node:assert/strict";
import { cityName, companyName, seniorityOf } from "../../src/lib/arka/normalize.mjs";

test("Amazon legal entities collapse to one employer", () => {
  for (const s of ["ASSPL - Karnataka - B56", "ADCI HYD 13 SEZ", "ADCI - Uttar Pradesh", "Amazon Web Services India"]) assert.equal(companyName(s), "Amazon");
  assert.equal(companyName("Zeta Pvt Ltd"), "Zeta");
  assert.equal(companyName("Delivery Hero"), "Delivery Hero");
});

test("city spellings merge", () => {
  for (const s of ["Bengaluru", "Bangalore", "bengaluru", "Bangalore · Bengaluru · India", "Bengaluru, Karnataka, India"]) assert.equal(cityName(s), "Bengaluru");
  assert.equal(cityName("Gurgaon, Haryana"), "Gurugram");
  assert.equal(cityName("India"), "India");
  assert.equal(cityName("Remote - India"), "Remote");
  assert.equal(cityName(""), "Not stated");
  assert.equal(cityName("Dubai - United Arab Emirates"), "Dubai");
});

test("seniority from titles", () => {
  assert.equal(seniorityOf("VP Operations"), "C-level & VP");
  assert.equal(seniorityOf("Head of Growth"), "Head & Director");
  assert.equal(seniorityOf("Senior Manager, Business Ops"), "Senior manager & lead");
  assert.equal(seniorityOf("Operations Manager"), "Manager");
  assert.equal(seniorityOf("Analyst"), "Other");
});

import { countryOf, employmentTypeOf, workModeOf } from "../../src/lib/arka/places.mjs";
test("country, work mode and employment type are read from posting text", () => {
  assert.equal(countryOf("Bengaluru, Karnataka, India"), "India");
  assert.equal(countryOf("Bangalore"), "India");
  assert.equal(countryOf("Dubai - United Arab Emirates"), "United Arab Emirates");
  assert.equal(countryOf("Austin, TX, USA"), "United States");
  assert.equal(countryOf("London"), "United Kingdom");
  assert.equal(countryOf("Remote"), "Remote / worldwide");
  assert.equal(countryOf(""), "Not stated");
  assert.equal(workModeOf("Hybrid - Pune"), "Hybrid");
  assert.equal(workModeOf("Remote, India"), "Remote");
  assert.equal(employmentTypeOf("Operations Intern"), "Internship");
  assert.equal(employmentTypeOf("Contract Program Manager"), "Contract");
  assert.equal(employmentTypeOf("Head of Growth"), "Full-time or not stated");
});
