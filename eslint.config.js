import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// The zero-network guarantee (SECURITY.md). scripts/check-bundle.mjs
// enforces the same list on dist/ independently. Never weaken either check.

const networkGlobals = [
  "fetch",
  "fetchLater",
  "Audio",
  "caches",
  "XMLHttpRequest",
  "WebSocket",
  "WebTransport",
  "EventSource",
  "RTCPeerConnection",
  "Worker",
  "SharedWorker",
  "importScripts",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "eval",
  "open",
].map((name) => ({
  name,
  message: `${name} is forbidden in src/: shipped code makes no requests and uses no browser storage.`,
}));

// Reaching the same things through an object, such as window.fetch or document.cookie.
const forbiddenProperties = [
  "fetch",
  "fetchLater",
  "caches",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "sendBeacon",
  "serviceWorker",
  "importScripts",
  "cookie",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "eval",
  "insertAdjacentHTML",
  "createContextualFragment",
]
  .map((property) => ({ property }))
  .concat(
    ["window", "globalThis", "self"].map((object) => ({
      object,
      property: "open",
    })),
  )
  .map((entry) => ({
    ...entry,
    message: `.${entry.property} is forbidden in src/ (zero-network and no-injection rules, see SECURITY.md).`,
  }));

// Elements that load a URL, submit, redirect, or change how URLs resolve.
const forbiddenElements =
  "script|img|image|iframe|frame|link|object|embed|form|meta|base|audio|video|source|track|area|portal";

// A same-origin path such as "/" or "/direct/inbox/", never "//host".
const sameOriginPath = "/^[/]([^/]|$)/";

const forbiddenSyntax = [
  {
    selector:
      "AssignmentExpression[left.type='MemberExpression'][left.property.name=/^(innerHTML|outerHTML|src|srcset|srcdoc|href|action|formAction)$/]",
    message:
      "Assigning innerHTML, outerHTML, src, srcset, srcdoc, href, or action is forbidden in src/.",
  },
  {
    selector:
      "CallExpression[callee.property.name=/^setAttribute(NS)?$/][arguments.0.value=/^(src|srcset|srcdoc|href|xlink:href|action|formaction|on.*)$/i]",
    message: "Setting a URL or event-handler attribute is forbidden in src/.",
  },
  {
    selector:
      "CallExpression[callee.property.name='setAttributeNS'][arguments.1.value=/^(src|srcset|srcdoc|href|xlink:href|action|formaction|on.*)$/i]",
    message: "Setting a URL or event-handler attribute is forbidden in src/.",
  },
  {
    selector: `CallExpression[callee.property.name='createElement'][arguments.0.value=/^(${forbiddenElements})$/i]`,
    message:
      "Creating elements that load URLs, submit, or redirect is forbidden in src/.",
  },
  {
    selector: `CallExpression[callee.property.name='createElementNS'][arguments.1.value=/^(${forbiddenElements})$/i]`,
    message:
      "Creating elements that load URLs, submit, or redirect is forbidden in src/.",
  },
  {
    selector: `CallExpression[callee.object.name='location'][callee.property.name=/^(assign|replace)$/]:not([arguments.0.value=${sameOriginPath}])`,
    message:
      'location.assign and location.replace only take a same-origin path literal, such as "/".',
  },
  {
    selector: `CallExpression[callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]:not([arguments.0.value=${sameOriginPath}])`,
    message:
      'location.assign and location.replace only take a same-origin path literal, such as "/".',
  },
  {
    selector:
      "AssignmentExpression[left.name='location'], AssignmentExpression[left.property.name='location']",
    message:
      "Assigning location is forbidden in src/. Use location.replace with a path literal.",
  },
  {
    selector:
      "Literal[value=/url *[(]|@import/i], TemplateElement[value.raw=/url *[(]|@import/i]",
    message: "CSS url() and @import are forbidden in src/: they make requests.",
  },
  {
    selector:
      "NewExpression[callee.name='Function'], CallExpression[callee.name='Function']",
    message: "new Function is forbidden in src/.",
  },
  {
    selector: "ImportExpression",
    message: "Dynamic import() is forbidden in src/.",
  },
];

export default defineConfig(
  {
    ignores: [
      "reference/**",
      "dist/**",
      "fixtures/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,js,mjs}"],
    rules: {
      "no-restricted-globals": ["error", ...networkGlobals],
      "no-restricted-properties": ["error", ...forbiddenProperties],
      "no-restricted-syntax": ["error", ...forbiddenSyntax],
    },
  },
);
