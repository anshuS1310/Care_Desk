import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indiaToday, validateDraft } from "../src/validation.ts";

const fixtures = JSON.parse(readFileSync(new URL("../../shared/name-fixtures.json", import.meta.url), "utf8"));
fixtures.push(
  { name: "A".repeat(100), valid: true, cleaned: "A".repeat(100) },
  { name: "A".repeat(101), valid: false },
);
const options = {
  genders: ["Female"],
  wards: ["General Ward"],
  departments: ["General Medicine"],
  doctors: ["Dr. Sharma"],
};
for (const fixture of fixtures) {
  const result = validateDraft({
    name: fixture.name,
    age: "25",
    gender: "Female",
    ward: "General Ward",
    department: "General Medicine",
    doctor: "Dr. Sharma",
    admission_date: indiaToday(),
  }, options);
  assert.equal(Boolean(result.values), fixture.valid, `Wrong validity for ${JSON.stringify(fixture.name)}`);
  if (fixture.valid) assert.equal(result.values.name, fixture.cleaned);
}
console.log(`${fixtures.length} shared name fixtures passed in JavaScript.`);
