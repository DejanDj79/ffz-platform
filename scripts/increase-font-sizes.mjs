import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const MARKER = path.resolve(".ffz-font-size-offset-applied");
const KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "xx-small",
  "x-small",
  "small",
  "medium",
  "large",
  "x-large",
  "xx-large",
  "xxx-large",
  "smaller",
  "larger",
  "math",
]);

async function cssFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await cssFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(fullPath);
  }
  return files;
}

function increaseValue(rawValue) {
  const value = rawValue.trim();
  if (!value || KEYWORDS.has(value.toLowerCase())) return value;

  const px = value.match(/^(-?\d*\.?\d+)px$/i);
  if (px) {
    const next = Number(px[1]) + 2;
    return `${Number.isInteger(next) ? next : Number(next.toFixed(3))}px`;
  }

  if (/^0(?:\.0+)?$/.test(value)) return "2px";
  return `calc(${value} + 2px)`;
}

function transformCss(source) {
  return source.replace(
    /(font-size\s*:\s*)([^;{}]+)(;)/gi,
    (match, prefix, value, suffix) => `${prefix}${increaseValue(value)}${suffix}`,
  );
}

try {
  await fs.access(MARKER);
  console.log("FFZ +2px font-size migration already applied; nothing to do.");
  process.exit(0);
} catch {}

const files = await cssFiles(ROOT);
let changedFiles = 0;
let changedDeclarations = 0;

for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  const matchesBefore = source.match(/font-size\s*:/gi)?.length ?? 0;
  const transformed = transformCss(source);
  if (transformed !== source) {
    await fs.writeFile(file, transformed);
    changedFiles += 1;
    changedDeclarations += matchesBefore;
  }
}

const globalsPath = path.resolve("src/app/globals.css");
let globals = await fs.readFile(globalsPath, "utf8");
if (!globals.includes("/* FFZ default inherited font size */")) {
  globals += "\n\n/* FFZ default inherited font size */\nbody { font-size: 18px; }\n";
  await fs.writeFile(globalsPath, globals);
}

await fs.writeFile(
  MARKER,
  `Applied global +2px font-size source migration to ${changedFiles} CSS files / ${changedDeclarations} declarations.\n`,
);

console.log(`Updated ${changedFiles} CSS files and ${changedDeclarations} font-size declarations.`);
