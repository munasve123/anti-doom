import { describe, expect, it } from "vitest";
import {
  decide,
  isInScope,
  normalisePath,
  type Redirect,
} from "../../src/core/guard";
import { DEFAULTS, type Settings } from "../../src/core/settings";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULTS,
  ...overrides,
});
const messagesOnly = settings({ mode: "messagesOnly" });

describe("decide: default settings", () => {
  it.each<[string, Redirect | null]>([
    ["/", null],
    ["/reels/", "/"],
    ["/reels", "/"],
    ["/reels/x/", "/"],
    ["/reel/x/", null],
    ["/someone/reel/x/", null],
    ["/explore/", "/explore/search/"],
    ["/explore", "/explore/search/"],
    ["/explore/search/", null],
    ["/explore/search/keyword/", null],
    ["/explore/tags/x/", "/explore/search/"],
    ["/explore/locations/1/x/", "/explore/search/"],
    ["/direct/inbox/", null],
    ["/direct/t/x/", null],
    ["/someone/", null],
    ["/someone/reels/", null],
    ["/p/x/", null],
    ["/stories/someone/1/", null],
  ])("%s -> %s", (path, expected) => {
    expect(decide(path, DEFAULTS)).toBe(expected);
  });
});

describe("decide: shared reels", () => {
  it("blocks a single reel when shared reels are off", () => {
    expect(decide("/reel/x/", settings({ allowSharedReels: false }))).toBe("/");
    expect(
      decide("/someone/reel/x/", settings({ allowSharedReels: false })),
    ).toBe("/");
  });

  it("leaves profile reels tabs alone either way", () => {
    expect(
      decide("/someone/reels/", settings({ allowSharedReels: false })),
    ).toBeNull();
  });

  it("allows everything reel-related when reels URLs aren't blocked", () => {
    const open = settings({ blockReelsUrl: false, allowSharedReels: false });
    expect(decide("/reels/", open)).toBeNull();
    expect(decide("/reel/x/", open)).toBeNull();
  });
});

describe("decide: search and explore (C10)", () => {
  it("sends explore home once search is hidden too", () => {
    const hidden = settings({ hideSearch: true });
    expect(decide("/explore/", hidden)).toBe("/");
    expect(decide("/explore/search/", hidden)).toBe("/");
    expect(decide("/explore/tags/x/", hidden)).toBe("/");
  });

  it("allows explore when explore URLs aren't blocked", () => {
    const open = settings({ blockExploreUrl: false, hideSearch: true });
    expect(decide("/explore/", open)).toBeNull();
    expect(decide("/explore/search/", open)).toBeNull();
  });
});

describe("decide: messages-only mode", () => {
  it.each<[string, Redirect | null]>([
    ["/", "/direct/inbox/"],
    ["/reels/", "/direct/inbox/"],
    ["/reel/x/", "/direct/inbox/"],
    ["/explore/", "/direct/inbox/"],
    ["/explore/search/", "/direct/inbox/"],
    ["/explore/tags/x/", "/direct/inbox/"],
    ["/someone/", "/direct/inbox/"],
    ["/someone/reels/", "/direct/inbox/"],
    ["/p/x/", "/direct/inbox/"],
    ["/direct", null],
    ["/direct/inbox/", null],
    ["/direct/t/x/", null],
    ["/directions/", "/direct/inbox/"],
  ])("%s -> %s", (path, expected) => {
    expect(decide(path, messagesOnly)).toBe(expected);
  });
});

describe("decide: path normalisation", () => {
  it.each(["/Reels/", "//reels/", "/%72eels/"])("still blocks %s", (path) => {
    expect(decide(path, DEFAULTS)).toBe("/");
  });
});

describe("decide: undecodable paths", () => {
  it("stays put rather than guessing", () => {
    expect(decide("/%E0%A4%A/", DEFAULTS)).toBeNull();
    expect(decide("/%E0%A4%A/", messagesOnly)).toBeNull();
  });
});

describe("decide: never redirects in a loop", () => {
  const paths = [
    "/",
    "/reels/",
    "/reel/x/",
    "/explore/",
    "/explore/search/",
    "/explore/tags/x/",
    "/direct/inbox/",
    "/direct/t/x/",
    "/someone/",
    "/p/x/",
  ];
  const flags = [
    "blockReelsUrl",
    "blockExploreUrl",
    "allowSharedReels",
    "hideSearch",
    "messagesOnly",
  ] as const;

  it("every redirect target is left alone under the same settings", () => {
    for (let bits = 0; bits < 2 ** flags.length; bits++) {
      const on = (i: number) => Boolean(bits & (1 << i));
      const s = settings({
        blockReelsUrl: on(0),
        blockExploreUrl: on(1),
        allowSharedReels: on(2),
        hideSearch: on(3),
        mode: on(4) ? "messagesOnly" : "normal",
      });
      for (const path of paths) {
        const target = decide(path, s);
        if (target !== null)
          expect(decide(target, s), `${path} under ${bits}`).toBeNull();
      }
    }
  });
});

describe("isInScope (C11: never on login or security pages)", () => {
  const at = (href: string) => {
    const url = new URL(href);
    return isInScope({
      protocol: url.protocol,
      hostname: url.hostname,
      pathname: url.pathname,
    });
  };

  it.each([
    "https://www.instagram.com/",
    "https://instagram.com/",
    "https://www.instagram.com/direct/inbox/",
    "https://www.instagram.com/accountsx/",
  ])("runs on %s", (href) => {
    expect(at(href)).toBe(true);
  });

  it.each([
    "https://www.instagram.com/accounts/login/",
    "https://www.instagram.com/accounts/",
    "https://www.instagram.com/accounts",
    "https://instagram.com/accounts/password/reset/",
    "https://www.instagram.com/accounts/activity/",
    "https://www.instagram.com/challenge/",
    "https://www.instagram.com/challenge/action/x/",
    "https://www.instagram.com/ACCOUNTS/login/",
    "https://www.instagram.com//accounts/login/",
    "https://www.instagram.com/%61ccounts/login/",
    "https://www.instagram.com/%E0%A4%A/accounts/",
    "http://www.instagram.com/",
    "https://help.instagram.com/",
    "https://i.instagram.com/",
    "https://instagram.com.example.invalid/",
    "https://example.invalid/",
  ])("refuses %s", (href) => {
    expect(at(href)).toBe(false);
  });
});

describe("normalisePath", () => {
  it.each([
    ["/", "/"],
    ["/Direct/Inbox/", "/direct/inbox/"],
    ["//a///b/", "/a/b/"],
    ["/%61/", "/a/"],
  ])("%s -> %s", (input, expected) => {
    expect(normalisePath(input)).toBe(expected);
  });

  it("returns null for undecodable paths, so callers fail closed", () => {
    expect(normalisePath("/%E0%A4%A/")).toBeNull();
  });
});
