import { createRequire } from "node:module";
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const require = createRequire(import.meta.url);
const worker = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const target = resolve("public/vendor/pdfjs/pdf.worker.min.mjs");
await mkdir(dirname(target), { recursive: true });
await copyFile(worker, target);
