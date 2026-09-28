# Anti-Doom

Use Instagram on your iPhone for the useful parts, without the parts built to keep you scrolling.

Anti-Doom runs in Safari on instagram.com and hides:

- the Reels tab and Explore
- the Stories row on the home feed
- Reels and suggested posts in the feed
- the bottomless feed, if you set a post limit

Messages, posts from people you follow, profiles, and posting keep working. Every surface is a toggle.

Not affiliated with, endorsed by, or connected to Instagram or Meta.

## Status

Early development. There's nothing to install yet. Install instructions will live in docs/INSTALL.md once the first release is out.

## Privacy, in short

- It runs only on instagram.com, and never on the login or security pages.
- It makes no network requests of any kind. The build fails if code that could appear.
- Settings stay on your phone. No accounts, analytics, or crash reporting.
- The shipped script is unminified and has no third-party code, so you can read all of it.

See PRIVACY.md and SECURITY.md for the detail.

## How it works

A userscript for the free, open-source [Userscripts](https://github.com/quoid/userscripts) Safari extension. It hides page elements using links, accessibility labels, and page structure, and never reads your messages or posts. A native Safari extension may follow later.

## Contributing

See docs/DEV-SETUP.md. Leak reports are welcome, but only ever paste output from Anti-Doom's own "Copy page structure", never raw page HTML or screenshots of your messages.

## Licence

MIT. See LICENSE.
