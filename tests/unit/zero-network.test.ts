// @vitest-environment node
/// <reference types="node" />
// Proves the two zero-network checks (ESLint on src/, check-bundle.mjs on dist/) catch every
// forbidden primitive, and still allow what the engine legitimately needs. If a rule is
// weakened or deleted, this fails.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ESLint } from "eslint";
import { afterAll, describe, expect, it } from "vitest";

type Case = { name: string; code: string; bundleOnly?: boolean };

const forbidden: Case[] = [
  { name: "fetch", code: 'fetch("/x");' },
  { name: "window.fetch", code: 'window.fetch("/x");' },
  { name: "destructured fetch", code: 'const { fetch: f } = window; f("/x");' },
  { name: "computed fetch", code: 'globalThis["fetch"]("/x");' },
  { name: "fetchLater", code: 'fetchLater("/x");' },
  { name: "XMLHttpRequest", code: "new XMLHttpRequest();" },
  { name: "WebSocket", code: 'new WebSocket("/x");' },
  { name: "EventSource", code: 'new EventSource("/x");' },
  { name: "sendBeacon", code: 'navigator.sendBeacon("/x");' },
  {
    name: "service worker",
    code: 'navigator.serviceWorker.register("/sw.js");',
  },
  { name: "Worker", code: 'new Worker("/w.js");' },
  { name: "Audio", code: 'new Audio("/a.mp3");' },
  { name: "Cache API", code: 'caches.open("x");' },
  { name: "document.cookie", code: "void document.cookie;" },
  { name: "localStorage", code: 'localStorage.getItem("x");' },
  { name: "sessionStorage", code: 'sessionStorage.getItem("x");' },
  { name: "indexedDB", code: 'indexedDB.open("x");' },
  { name: "eval", code: 'eval("1");' },
  { name: "new Function", code: 'new Function("return 1");' },
  { name: "dynamic import", code: 'void import("/x.js");' },
  { name: "window.open", code: 'window.open("/x");' },
  { name: "innerHTML", code: 'document.body.innerHTML = "<b>x</b>";' },
  { name: "outerHTML", code: 'document.body.outerHTML = "<b>x</b>";' },
  {
    name: "insertAdjacentHTML",
    code: 'document.body.insertAdjacentHTML("beforeend", "<b>");',
  },
  { name: "href assignment", code: 'document.createElement("a").href = "/x";' },
  { name: "src assignment", code: 'el.src = "/x.png";' },
  { name: "action assignment", code: 'el.action = "/x";' },
  { name: "setAttribute href", code: 'el.setAttribute("href", "/x");' },
  { name: "setAttribute handler", code: 'el.setAttribute("onclick", "x()");' },
  ...["script", "img", "iframe", "link", "form", "meta", "base", "audio"].map(
    (tag) => ({
      name: `createElement ${tag}`,
      code: `document.createElement("${tag}");`,
    }),
  ),
  {
    name: "protocol-relative redirect",
    code: 'location.replace("//e.invalid/?d=1");',
  },
  {
    name: "absolute redirect",
    code: 'window.location.assign("https://e.invalid/");',
  },
  { name: "computed redirect", code: "location.replace(target);" },
  { name: "location assignment", code: 'location = "/x";' },
  {
    name: "CSS url()",
    code: 'style.textContent = "a { background: url(/x.png) }";',
  },
  { name: "CSS @import", code: 'style.textContent = `@import "/x.css";`;' },
  {
    name: "absolute URL",
    code: 'const u = "https://e.invalid/";',
    bundleOnly: true,
  },
  {
    name: "protocol-relative URL",
    code: 'const u = "//e.invalid/x";',
    bundleOnly: true,
  },
];

const allowed: Case[] = [
  {
    name: "the hiding stylesheet",
    code: [
      'const style = document.createElement("style");',
      'style.textContent = "[data-anti-doom-hidden] { display: none !important; }";',
      "document.head.append(style);",
    ].join("\n"),
  },
  { name: "redirect home", code: 'location.replace("/");' },
  { name: "redirect to inbox", code: 'location.replace("/direct/inbox/");' },
  { name: "reading the path", code: "const path = location.pathname;" },
  {
    name: "href selectors",
    code: "document.querySelectorAll('a[href^=\"/reels/\"]');",
  },
  {
    name: "hide mark",
    code: 'el.setAttribute("data-anti-doom-hidden", "reel");',
  },
  { name: "text content", code: 'el.textContent = "You have seen 10 posts.";' },
  { name: "details toggle", code: "if (details.open) details.open = false;" },
];

describe("ESLint zero-network rules on src/", () => {
  const eslint = new ESLint();
  const restricted = async (code: string) => {
    const [result] = await eslint.lintText(code, { filePath: "src/probe.ts" });
    return (result?.messages ?? []).filter((m) =>
      m.ruleId?.startsWith("no-restricted"),
    );
  };

  it.each(forbidden.filter((c) => !c.bundleOnly))(
    "rejects $name",
    async ({ code }) => {
      expect(await restricted(code)).not.toHaveLength(0);
    },
  );

  it.each(allowed)("allows $name", async ({ code }) => {
    expect(await restricted(code)).toEqual([]);
  });
});

describe("check-bundle.mjs on dist/", () => {
  const dirs: string[] = [];
  afterAll(() =>
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
  );

  const checkBundle = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "anti-doom-bundle-"));
    dirs.push(dir);
    for (const [name, text] of Object.entries(files))
      writeFileSync(join(dir, name), text);
    return spawnSync(process.execPath, ["scripts/check-bundle.mjs", dir])
      .status;
  };

  it.each(forbidden)("rejects $name", ({ code }) => {
    expect(checkBundle({ "anti-doom.user.js": code })).toBe(1);
  });

  it("rejects forbidden code in an HTML file", () => {
    expect(checkBundle({ "popup.html": '<script>fetch("/x")</script>' })).toBe(
      1,
    );
  });

  it("allows every legitimate snippet together", () => {
    const code = allowed.map((c) => c.code).join("\n");
    expect(checkBundle({ "anti-doom.user.js": code })).toBe(0);
  });

  it("allows URLs inside the userscript metadata block", () => {
    const code = [
      "// ==UserScript==",
      "// @match https://www.instagram.com/*",
      "// ==/UserScript==",
      'location.replace("/");',
    ].join("\n");
    expect(checkBundle({ "anti-doom.user.js": code })).toBe(0);
  });

  it("rejects minified output", () => {
    expect(checkBundle({ "anti-doom.user.js": "x;".repeat(100) })).toBe(1);
  });

  it("rejects an empty directory", () => {
    expect(checkBundle({})).toBe(1);
  });
});
