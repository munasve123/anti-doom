// User settings: a versioned schema with defaults. Anything invalid in storage falls back to
// its default, field by field, so one corrupted value never resets everything else.
import type { Storage } from "./storage";

export const SCHEMA_VERSION = 1;
export const SETTINGS_KEY = "settings";

export const FEED_LIMITS = [0, 5, 10, 15, 20, 30, 50] as const;
export type FeedLimit = (typeof FEED_LIMITS)[number];

export const MODES = ["normal", "messagesOnly"] as const;
export type Mode = (typeof MODES)[number];

export interface Settings {
  schemaVersion: typeof SCHEMA_VERSION;
  hideReelsTab: boolean;
  hideExploreTab: boolean;
  hideSearch: boolean;
  hideNotifications: boolean;
  hideStories: boolean;
  hideFeedReels: boolean;
  hideSuggested: boolean;
  /** Posts shown on the home feed before it stops. 0 means no limit. */
  feedLimit: FeedLimit;
  blockReelsUrl: boolean;
  blockExploreUrl: boolean;
  /** Lets a single /reel/ link open, such as one a friend sends in a message. */
  allowSharedReels: boolean;
  mode: Mode;
  showPanelButton: boolean;
  debug: boolean;
}

export const DEFAULTS: Readonly<Settings> = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  hideReelsTab: true,
  hideExploreTab: true,
  hideSearch: false,
  hideNotifications: false,
  hideStories: true,
  hideFeedReels: true,
  hideSuggested: true,
  feedLimit: 0,
  blockReelsUrl: true,
  blockExploreUrl: true,
  allowSharedReels: true,
  mode: "normal",
  showPanelButton: true,
  debug: false,
});

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const BOOLEAN_KEYS = Object.keys(DEFAULTS).filter(
  (key): key is BooleanKey =>
    typeof DEFAULTS[key as keyof Settings] === "boolean",
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function isOneOf<T>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T);
}

/** Returns a complete, valid Settings object. Invalid or missing fields take their defaults. */
export function validate(input: unknown): Settings {
  const result: Settings = { ...DEFAULTS };
  if (!isRecord(input)) return result;

  for (const key of BOOLEAN_KEYS) {
    const value = own(input, key);
    if (typeof value === "boolean") result[key] = value;
  }
  const feedLimit = own(input, "feedLimit");
  if (isOneOf(FEED_LIMITS, feedLimit)) result.feedLimit = feedLimit;
  const mode = own(input, "mode");
  if (isOneOf(MODES, mode)) result.mode = mode;

  return result;
}

/**
 * Brings stored settings up to the current schema. Version 1 is the first, so there are no
 * migration steps yet: unversioned and current data are validated as they are, and data from a
 * newer version (after a downgrade) keeps every field that is still valid.
 */
export function migrate(input: unknown): Settings {
  return validate(input);
}

export async function loadSettings(storage: Storage): Promise<Settings> {
  try {
    return migrate(await storage.get(SETTINGS_KEY));
  } catch {
    return validate(undefined);
  }
}

export async function saveSettings(
  storage: Storage,
  settings: Settings,
): Promise<void> {
  await storage.set(SETTINGS_KEY, validate(settings));
}
