# Vendored dependency

pdf.js 4.10.38 — `legacy/build/pdf.min.mjs` and `legacy/build/pdf.worker.min.mjs`,
copied from the npm package `pdfjs-dist`.

These files are committed deliberately, so the tool keeps working from a plain
checkout with no `npm install` and no CDN. The `legacy` build is used because it
targets older browsers, which matters for phones that stop getting updates.

To update:

```sh
npm install pdfjs-dist@latest
cp node_modules/pdfjs-dist/legacy/build/pdf.min.mjs vendor/
cp node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs vendor/
npm test
```

Then re-check the version number at the top of this file.
