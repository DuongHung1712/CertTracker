// Usage: pnpm make:import-file <people.json> <out.xlsx>   |   pnpm make:import-file --rehearsal <out.xlsx>
// Real files go under private/ (git-ignored). Prints team names only, never people's names or e-mails.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { dirname } from "node:path";
import { z } from "zod";

// Node cannot resolve the app's "@/" imports by itself; register the alias hook before loading the app code.
register("./alias-hooks.mjs", import.meta.url);
const { buildSampleWorkbook, readCatalogueSql, rehearsalPeople } = await import("../src/features/import/sample-workbook");
const { todayVn } = await import("../src/lib/dates");

const CATALOGUE_PATH = "supabase/catalog/courses.sql";
const REHEARSAL_FLAG = "--rehearsal";

const peopleSchema = z.array(
  z.object({
    fullName: z.string().min(1),
    email: z.string().min(1),
    team: z.string().min(1),
    certificates: z.array(
      z.object({
        course: z.string().min(1),
        status: z.enum(["done", "in_progress", "not_started"]),
        progress: z.number().min(0).max(100),
        plannedExamDate: z.string().optional(),
        issuedDate: z.string().optional(),
      }),
    ),
  }),
);

const args = process.argv.slice(2);
const isRehearsal = args[0] === REHEARSAL_FLAG;
const [inputPath, outputPath] = isRehearsal ? [null, args[1]] : args;
if (!outputPath || (!isRehearsal && !inputPath)) {
  console.error(`Usage: make-import-file <people.json> <out.xlsx> | ${REHEARSAL_FLAG} <out.xlsx>`);
  process.exit(1);
}

const today = todayVn();
const catalogue = readCatalogueSql(readFileSync(CATALOGUE_PATH, "utf8"));
const people = isRehearsal ? rehearsalPeople(today, catalogue) : peopleSchema.parse(JSON.parse(readFileSync(inputPath!, "utf8")));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, buildSampleWorkbook(people, catalogue, today));

const teams = [...new Set(people.map((person) => person.team))].sort();
console.log(`Wrote ${outputPath}: ${people.length} people.`);
console.log(`Create these teams at /org before importing: ${teams.join(", ")}`);
