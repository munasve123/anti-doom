# Security

## What Anti-Doom guarantees

- Scope: it matches only https://www.instagram.com/* and https://instagram.com/*.
- Login and security pages: /accounts/* and /challenge/* are excluded in the userscript metadata, and the engine also refuses to start on them. Passwords are typed into pages this code never runs on.
- No network: the shipped code makes no requests of any kind. ESLint and an independent bundle check fail the build if a network or code-injection primitive appears.
- Local only: settings and health counters stay in the userscript manager's storage on your device.
- Auditable: zero runtime dependencies and an unminified bundle.

## What it doesn't protect against

- The Userscripts app itself runs with permission on instagram.com. It's open source, but it's a dependency you trust.
- Whoever controls this GitHub account controls future releases. Read release notes before updating.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability") rather than a public issue. Don't include Instagram credentials, cookies, or raw page HTML in any report.
