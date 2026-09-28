// Scans everything built into dist/ (or the directory given as the first argument) for
// forbidden primitives with plain regular expressions.
// This is a second check, independent of ESLint, so a gap in one isn't a gap in both.
// Never weaken it (SECURITY.md).
//
// Exact userscript metadata assertions are still to come.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = process.argv[2] ?? "dist";
const SCANNED = /\.(js|html|css)$/;
const MAX_USERSCRIPT_BYTES = 150 * 1024;
const MAX_AVERAGE_LINE_LENGTH = 120;

const forbidden = [
  [/\bfetch(Later)?\b/, "fetch"],
  [/\bAudio\s*\(/, "new Audio"],
  [/\bcaches\b/, "the Cache API"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bWebTransport\b/, "WebTransport"],
  [/\bEventSource\b/, "EventSource"],
  [/\bRTCPeerConnection\b/, "RTCPeerConnection"],
  [/\b(Shared)?Worker\s*\(/, "Worker"],
  [/\bsendBeacon\b/, "navigator.sendBeacon"],
  [/\bimportScripts\b/, "importScripts"],
  [/\bserviceWorker\b/, "service workers"],
  [/\.cookie\b/, "document.cookie"],
  [/\blocalStorage\b/, "localStorage"],
  [/\bsessionStorage\b/, "sessionStorage"],
  [/\bindexedDB\b/, "indexedDB"],
  [/\beval\s*\(/, "eval"],
  [/\bFunction\s*\(/, "new Function"],
  [/\bimport\s*\(/, "dynamic import()"],
  [/\b(window|globalThis|self)\.open\s*\(/, "window.open"],
  [/(^|[^.\w$])open\s*\(/, "open()"],
  [
    /\.(innerHTML|outerHTML|src|srcset|srcdoc|href|action|formAction)\s*=(?!=)/,
    "assigning innerHTML, outerHTML, src, href, or action",
  ],
  [
    /\binsertAdjacentHTML\b|\bcreateContextualFragment\b|\bdocument\.write/,
    "HTML injection",
  ],
  [
    /setAttribute(NS)?\s*\([^)]*["'](src|srcset|srcdoc|href|xlink:href|action|formaction|on\w+)["']/i,
    "setting a URL or handler attribute",
  ],
  [
    /createElement(NS)?\s*\([^)]*["'](script|img|image|iframe|frame|link|object|embed|form|meta|base|audio|video|source|track|area|portal)["']/i,
    "creating an element that loads a URL, submits, or redirects",
  ],
  [
    /location\s*\.\s*(assign|replace)\s*\(\s*(?!["'`]\/(?!\/))/,
    "location.assign or replace without a same-origin path literal",
  ],
  [/\blocation\s*=(?!=)/, "assigning location"],
  [/url\s*\(|@import/i, "CSS url() or @import"],
  [/https?:\/\//, "a URL outside the userscript metadata block"],
  [/["'`(=]\s*\/\/[\w-]+\.[\w.-]/, "a protocol-relative URL"],
];

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

// The metadata block legitimately holds @match and @updateURL URLs. Blank it, keeping line numbers.
function withoutMetadata(text) {
  return text.replace(
    /\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/,
    (block) => block.replace(/[^\n]/g, ""),
  );
}

let files;
try {
  files = listFiles(DIST).filter((file) => SCANNED.test(file));
} catch {
  files = [];
}
if (files.length === 0) {
  console.error(
    `check:bundle: no .js, .html, or .css files in ${DIST}. Run npm run build first.`,
  );
  process.exit(1);
}

const failures = [];

for (const file of files) {
  const name = relative(".", file).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");
  const lines = withoutMetadata(text).split("\n");

  lines.forEach((line, index) => {
    for (const [pattern, label] of forbidden) {
      if (pattern.test(line)) failures.push(`${name}:${index + 1}: ${label}`);
    }
  });

  const nonEmpty = text.split("\n").filter((line) => line.trim() !== "");
  const average =
    nonEmpty.reduce((sum, line) => sum + line.length, 0) /
    Math.max(nonEmpty.length, 1);
  if (average >= MAX_AVERAGE_LINE_LENGTH) {
    failures.push(
      `${name}: looks minified (average line length ${average.toFixed(0)})`,
    );
  }

  if (
    name.endsWith("anti-doom.user.js") &&
    Buffer.byteLength(text) > MAX_USERSCRIPT_BYTES
  ) {
    failures.push(
      `${name}: ${Buffer.byteLength(text)} bytes, over the ${MAX_USERSCRIPT_BYTES} byte budget`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    `check:bundle failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`check:bundle passed (${files.length} files).`);
