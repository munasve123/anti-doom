import { describe, expect, it } from "vitest";
import {
  DEFAULTS,
  FEED_LIMITS,
  SCHEMA_VERSION,
  SETTINGS_KEY,
  loadSettings,
  migrate,
  saveSettings,
  validate,
  type Settings,
} from "../../src/core/settings";
import { createMemoryStorage, type Storage } from "../../src/core/storage";

const custom: Settings = {
  schemaVersion: 1,
  hideReelsTab: false,
  hideExploreTab: false,
  hideSearch: true,
  hideNotifications: true,
  hideStories: false,
  hideFeedReels: false,
  hideSuggested: false,
  feedLimit: 20,
  blockReelsUrl: false,
  blockExploreUrl: false,
  allowSharedReels: false,
  mode: "messagesOnly",
  showPanelButton: false,
  debug: true,
};

describe("DEFAULTS", () => {
  it("matches the documented defaults", () => {
    expect(DEFAULTS).toEqual({
      schemaVersion: 1,
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
    expect(SCHEMA_VERSION).toBe(1);
    expect(FEED_LIMITS).toEqual([0, 5, 10, 15, 20, 30, 50]);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
  });
});

describe("validate (C9: stored settings are validated)", () => {
  it.each([undefined, null, 5, "settings", true, [], [custom]])(
    "returns defaults for a non-object: %j",
    (input) => {
      expect(validate(input)).toEqual(DEFAULTS);
    },
  );

  it("keeps a fully valid object", () => {
    expect(validate(custom)).toEqual(custom);
  });

  it("returns a fresh object each time", () => {
    const result = validate(undefined);
    expect(result).not.toBe(DEFAULTS);
    result.hideStories = false;
    expect(DEFAULTS.hideStories).toBe(true);
  });

  it.each([
    ["hideReelsTab", "yes"],
    ["hideStories", 1],
    ["debug", null],
    ["feedLimit", 7],
    ["feedLimit", "10"],
    ["feedLimit", -5],
    ["feedLimit", Number.NaN],
    ["mode", "doomscroll"],
    ["mode", 1],
  ])("falls back to the default for an invalid %s (%j) only", (key, value) => {
    const result = validate({ ...custom, [key]: value });
    expect(result).toEqual({
      ...custom,
      [key]: DEFAULTS[key as keyof Settings],
    });
  });

  it("accepts every allowed feed limit", () => {
    for (const feedLimit of FEED_LIMITS) {
      expect(validate({ ...custom, feedLimit }).feedLimit).toBe(feedLimit);
    }
  });

  it("drops unknown keys and forces the schema version", () => {
    const result = validate({ ...custom, schemaVersion: 99, surprise: "x" });
    expect(result).toEqual(custom);
    expect(result).not.toHaveProperty("surprise");
  });

  it("ignores inherited properties", () => {
    const input = Object.create({ hideStories: false }) as object;
    expect(validate(input).hideStories).toBe(true);
  });
});

describe("migrate", () => {
  it("returns defaults when nothing is stored", () => {
    expect(migrate(undefined)).toEqual(DEFAULTS);
  });

  it("treats an unversioned object as the current schema", () => {
    const unversioned: Partial<Settings> = { ...custom };
    delete unversioned.schemaVersion;
    expect(migrate(unversioned)).toEqual(custom);
  });

  it("validates the current schema", () => {
    expect(migrate({ ...custom, feedLimit: 3 })).toEqual({
      ...custom,
      feedLimit: 0,
    });
  });

  it("keeps what it can from a newer schema, so a downgrade doesn't reset everything", () => {
    expect(migrate({ ...custom, schemaVersion: 2, newThing: true })).toEqual(
      custom,
    );
  });
});

describe("loadSettings and saveSettings", () => {
  it("loads defaults from empty storage", async () => {
    expect(await loadSettings(createMemoryStorage())).toEqual(DEFAULTS);
  });

  it("round-trips through storage", async () => {
    const storage = createMemoryStorage();
    await saveSettings(storage, custom);
    expect(await storage.get(SETTINGS_KEY)).toEqual(custom);
    expect(await loadSettings(storage)).toEqual(custom);
  });

  it("validates before saving", async () => {
    const storage = createMemoryStorage();
    await saveSettings(storage, {
      ...custom,
      feedLimit: 999,
    } as unknown as Settings);
    expect(await storage.get(SETTINGS_KEY)).toEqual({
      ...custom,
      feedLimit: 0,
    });
  });

  it("falls back to defaults when storage fails", async () => {
    const broken: Storage = {
      get: () => Promise.reject(new Error("storage unavailable")),
      set: () => Promise.resolve(),
      subscribe: () => () => undefined,
    };
    expect(await loadSettings(broken)).toEqual(DEFAULTS);
  });

  it("falls back per field for corrupted stored values", async () => {
    const storage = createMemoryStorage({
      [SETTINGS_KEY]: { ...custom, mode: "??" },
    });
    expect(await loadSettings(storage)).toEqual({ ...custom, mode: "normal" });
  });
});
