// Builds dist/anti-doom.user.js and dist/capture.js. Unminified on purpose, so anyone can audit it.
// With --watch, rebuilds on change and serves dist/ on localhost for desktop testing.
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "safari17",
  minify: false,
  sourcemap: false,
  legalComments: "none",
  charset: "utf8",
  logLevel: "info",
};

const builds = [
  {
    ...shared,
    entryPoints: ["src/userscript/entry.ts"],
    outfile: "dist/anti-doom.user.js",
  },
  {
    ...shared,
    entryPoints: ["src/capture/entry.ts"],
    outfile: "dist/capture.js",
  },
];

if (watch) {
  const contexts = await Promise.all(
    builds.map((options) => esbuild.context(options)),
  );
  await Promise.all(contexts.map((context) => context.watch()));
  const { port } = await contexts[0].serve({
    servedir: "dist",
    host: "127.0.0.1",
    port: 8000,
  });
  console.log(`Serving dist/ at http://127.0.0.1:${port}/`);
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}
