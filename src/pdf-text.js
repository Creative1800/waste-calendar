// @ts-check
/**
 * The only module that knows pdf.js exists. Kept deliberately thin: it turns a
 * PDF into plain {x, y, s} text items and nothing else, so every decision about
 * what those items mean lives in testable pure code.
 *
 * @typedef {import('./parse-schedule.js').TextItem} TextItem
 */

import * as pdfjsLib from '../vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../vendor/pdf.worker.min.mjs',
  import.meta.url,
).href;

/**
 * Extracts positioned text from every page of a PDF.
 *
 * @param {ArrayBuffer} buffer
 * @returns {Promise<TextItem[]>}
 */
export async function extractTextItems(buffer) {
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  /** @type {TextItem[]} */
  const items = [];
  for (let page = 1; page <= doc.numPages; page++) {
    const textContent = await (await doc.getPage(page)).getTextContent();
    for (const item of textContent.items) {
      const str = /** @type {any} */ (item).str;
      const transform = /** @type {any} */ (item).transform;
      if (!str || !str.trim() || !transform) continue;
      items.push({ page, x: transform[4], y: transform[5], s: str });
    }
  }
  await doc.destroy();
  return items;
}
