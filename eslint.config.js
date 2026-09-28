import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// The zero-network guarantee (SECURITY.md). scripts/check-bundle.mjs
// enforces the same list on dist/ independently. Never weaken either check.

const networkGlobals = [
  "fetch",
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

const forbiddenSyntax = [
  {
    selector:
      "AssignmentExpression[left.type='MemberExpression'][left.property.name=/^(innerHTML|outerHTML|src|srcset|srcdoc|href)$/]",
    message:
      "Assigning innerHTML, outerHTML, src, srcset, srcdoc, or href is forbidden in src/.",
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
    selector:
      "CallExpression[callee.property.name='createElement'][arguments.0.value=/^(script|img|iframe|frame|link|object|embed)$/i]",
    message:
      "Creating script, img, iframe, frame, link, object, or embed elements is forbidden in src/.",
  },
  {
    selector:
      "CallExpression[callee.property.name='createElementNS'][arguments.1.value=/^(script|img|image|iframe|frame|link|object|embed)$/i]",
    message:
      "Creating script, img, iframe, frame, link, object, or embed elements is forbidden in src/.",
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
