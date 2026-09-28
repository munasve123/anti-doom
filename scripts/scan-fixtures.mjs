// Privacy scan of everything under fixtures/ except incoming/. The full scanner isn't
// written yet. Until then it fails closed: any fixture file at all is a failure.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path === join("fixtures", "incoming")) return [];
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const files = listFiles("fixtures").filter(
  (file) => !file.endsWith(".gitkeep"),
);
if (files.length > 0) {
  console.error(
    `scan:fixtures: ${files.length} fixture file(s) found, but the scanner isn't implemented yet.`,
  );
  process.exit(1);
}
console.log("scan:fixtures passed (no fixtures yet).");
