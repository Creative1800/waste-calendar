// @ts-check
// Regenerates the text-item fixture from the real leaflet PDF.
// Run: npm run fixture
//
// Keeping the fixture as extracted coordinates (rather than re-parsing the PDF
// in every test run) means the pure parser can be tested without pdf.js, and
// the expected dates in the tests stay pinned to a known input.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const pdfPath = path.join(here, '..', 'test', 'fixtures', 'sabinov-2026-q4.pdf');
const outPath = path.join(here, '..', 'test', 'fixtures', 'sabinov-2026-q4.items.json');

const doc = await getDocument({
  data: new Uint8Array(fs.readFileSync(pdfPath)),
  useSystemFonts: true,
}).promise;

const items = [];
for (let page = 1; page <= doc.numPages; page++) {
  const textContent = await (await doc.getPage(page)).getTextContent();
  for (const item of textContent.items) {
    const { str, transform } = /** @type {any} */ (item);
    if (!str || !str.trim() || !transform) continue;
    items.push({
      page,
      x: +transform[4].toFixed(1),
      y: +transform[5].toFixed(1),
      s: str,
    });
  }
}

fs.writeFileSync(outPath, JSON.stringify(items) + '\n');
console.log(`wrote ${items.length} text items from ${doc.numPages} page(s)`);
