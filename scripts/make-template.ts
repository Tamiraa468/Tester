// Regenerates data/template.xlsx (the only data file that is committed).
// Run with: pnpm template:make
//
// The workbook itself is built by src/lib/import/template.ts, which the admin panel's
// download route also uses, so the file on disk and the one offered in the panel agree.

import { writeFile } from "node:fs/promises";
import { buildTemplateBuffer, TEMPLATE_EXAMPLE_COUNT } from "../src/lib/import/template";

const OUTPUT = "data/template.xlsx";

async function main(): Promise<void> {
  await writeFile(OUTPUT, await buildTemplateBuffer());
  console.log(`${OUTPUT} үүсгэлээ: ${TEMPLATE_EXAMPLE_COUNT} жишээ мөр + "Заавар" хуудас.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
