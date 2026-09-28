// Pure URL rules: where Anti-Doom may run at all, and which paths redirect elsewhere.
// No DOM access, so every case is a plain table test.
import type { Settings } from "./settings";

/** Every place the guard can send you. The engine maps each to a literal location.replace. */
export type Redirect = "/" | "/direct/inbox/" | "/explore/search/";

const HOSTS = new Set(["www.instagram.com", "instagram.com"]);

/**
 * Lowercases, percent-decodes, and collapses repeated slashes, so /ACCOUNTS/ or //accounts/
 * can't slip past a prefix check. Returns null if the path can't be decoded.
 */
export function normalisePath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  return decoded.toLowerCase().replace(/\/{2,}/g, "/");
}

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * True only on https Instagram pages outside /accounts/ and /challenge/, where logins, password
 * changes, and security checks happen. The userscript metadata excludes those paths too; this
 * check means the guarantee doesn't depend on the userscript manager honouring that.
 */
export function isInScope(location: {
  protocol: string;
  hostname: string;
  pathname: string;
}): boolean {
  if (location.protocol !== "https:" || !HOSTS.has(location.hostname))
    return false;
  const path = normalisePath(location.pathname);
  return (
    path !== null && !isUnder(path, "/accounts") && !isUnder(path, "/challenge")
  );
}

/**
 * A single reel, at /reel/<id>/ or /<username>/reel/<id>/. Not a profile's /reels/ tab.
 * Also matches the profile of a user literally named "reel", which is accepted as too rare to matter.
 */
const SINGLE_REEL = /^\/(?:[^/]+\/)?reel(?:\/|$)/;

/** Returns where to send the browser instead of pathname, or null to stay. */
export function decide(pathname: string, settings: Settings): Redirect | null {
  const path = normalisePath(pathname);
  if (path === null) return null;

  if (settings.mode === "messagesOnly") {
    return isUnder(path, "/direct") ? null : "/direct/inbox/";
  }

  if (settings.blockReelsUrl) {
    if (isUnder(path, "/reels")) return "/";
    if (!settings.allowSharedReels && SINGLE_REEL.test(path)) return "/";
  }

  // On mobile web, the Explore tab is also the way into search (C10). While search is allowed,
  // blocked Explore pages (the grid, hashtags, places) land on search rather than home.
  if (settings.blockExploreUrl && isUnder(path, "/explore")) {
    if (settings.hideSearch) return "/";
    return isUnder(path, "/explore/search") ? null : "/explore/search/";
  }

  return null;
}
