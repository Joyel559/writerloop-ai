import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const target = resolve("public/pdf.worker.min.mjs");
const reactPdfPackagePath = resolve("node_modules/react-pdf/package.json");
const pdfjsPackagePath = resolve("node_modules/pdfjs-dist/package.json");

const reactPdfPackage = JSON.parse(readFileSync(reactPdfPackagePath, "utf8"));
const installedPdfjsPackage = JSON.parse(readFileSync(pdfjsPackagePath, "utf8"));
const expectedPdfjsVersion = reactPdfPackage?.dependencies?.["pdfjs-dist"];

if (expectedPdfjsVersion && expectedPdfjsVersion !== installedPdfjsPackage.version) {
  throw new Error(
    `pdfjs-dist version mismatch: react-pdf expects ${expectedPdfjsVersion} but installed ${installedPdfjsPackage.version}. Run npm install to align versions.`,
  );
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);

console.log("Synced PDF worker:", source, "->", target);
