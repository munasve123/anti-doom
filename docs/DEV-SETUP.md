# Development setup (Windows)

## Prerequisites

- Git for Windows
- Node.js, current LTS (the version in .node-version)
- GitHub CLI, logged in with gh auth login
- VS Code

## First run

```
npm ci
npx playwright install webkit
npm run check
```

npm run check is everything CI runs, and must pass before every commit. The WebKit download is Playwright's own browser build, used by the browser tests. It isn't a project dependency.

## Commands

- npm run build: writes dist/anti-doom.user.js and dist/capture.js
- npm run dev: rebuilds on change and serves dist/ at http://127.0.0.1:8000/
- npm run typecheck, npm run lint, npm run format:check (npm run format fixes formatting)
- npm run test:unit, npm run test:fixtures, npm run test:browser
- npm run check:bundle: forbidden primitives, not minified, size budget
- npm run scan:fixtures: privacy scan of fixtures/
- npm run fixture:add -- <file in fixtures/incoming> --surface <name> (not implemented yet)
- npm run deploy:icloud (optional, not implemented yet)

## Line endings

.gitattributes forces LF for every text file, and .editorconfig tells VS Code the same. If git warns about CRLF, run git add --renormalize . once.

## Desktop testing against real Instagram

Available once the userscript does something. The loop will be: npm run dev, install http://127.0.0.1:8000/anti-doom.user.js in Violentmonkey on Firefox, then use responsive design mode with an iPhone preset while logged in to Instagram.
