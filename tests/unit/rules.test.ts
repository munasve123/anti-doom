import { describe, expect, it } from "vitest";
import {
  RULES,
  isActive,
  routeOf,
  ruleById,
  type RuleId,
} from "../../src/core/rules";
import { DEFAULTS, type Settings } from "../../src/core/settings";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULTS,
  ...overrides,
});
const enabledIds = (s: Settings) =>
  RULES.filter((rule) => rule.enabled(s)).map((rule) => rule.id);

describe("rule catalogue", () => {
  it("has unique ids and at least one strategy per rule", () => {
    const ids = RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of RULES) expect(rule.strategies.length).toBeGreaterThan(0);
  });

  it("keeps every CSS selector to a single selector, so one bad rule can't disable others", () => {
    for (const rule of RULES) {
      for (const strategy of rule.strategies) {
        if (strategy.kind === "css")
          expect(strategy.selector).not.toContain(",");
      }
    }
  });

  it("scopes every feed rule to the home route", () => {
    for (const rule of RULES)
      expect(rule.homeOnly).toBe(rule.id.startsWith("feed."));
  });

  it("looks rules up by id", () => {
    expect(ruleById("nav.reels")?.id).toBe("nav.reels");
    expect(ruleById("nope")).toBeUndefined();
  });
});

describe("which rules are enabled", () => {
  it("enables the defaults", () => {
    expect(enabledIds(DEFAULTS)).toEqual<RuleId[]>([
      "nav.reels",
      "feed.stories",
      "feed.reels",
      "feed.suggested",
    ]);
  });

  it("keeps the Explore tab while search is allowed, because it's also search on mobile (C10)", () => {
    expect(
      enabledIds(settings({ hideExploreTab: true, hideSearch: false })),
    ).not.toContain("nav.explore");
    expect(
      enabledIds(settings({ hideExploreTab: true, hideSearch: true })),
    ).toEqual(expect.arrayContaining(["nav.explore", "nav.search"]));
    expect(
      enabledIds(settings({ hideExploreTab: false, hideSearch: true })),
    ).not.toContain("nav.explore");
  });

  it("enables the feed limit only with a limit", () => {
    expect(enabledIds(settings({ feedLimit: 10 }))).toContain("feed.limit");
  });

  it("hides every nav entry but messages in messages-only mode", () => {
    const off = settings({
      hideReelsTab: false,
      hideExploreTab: false,
      mode: "messagesOnly",
    });
    expect(enabledIds(off)).toEqual(
      expect.arrayContaining([
        "nav.reels",
        "nav.explore",
        "nav.search",
        "nav.notifications",
        "nav.create",
      ]),
    );
  });

  it("enables nothing when everything is off", () => {
    const off = settings({
      hideReelsTab: false,
      hideExploreTab: false,
      hideStories: false,
      hideFeedReels: false,
      hideSuggested: false,
    });
    expect(enabledIds(off)).toEqual([]);
  });
});

describe("routes", () => {
  it.each([
    ["/", "home"],
    ["/someone/", "other"],
    ["/direct/inbox/", "other"],
  ] as const)("%s is %s", (path, route) => {
    expect(routeOf(path)).toBe(route);
  });

  it("applies home-only rules on home only", () => {
    const stories = ruleById("feed.stories")!;
    const reelsTab = ruleById("nav.reels")!;
    expect(isActive(stories, DEFAULTS, "home")).toBe(true);
    expect(isActive(stories, DEFAULTS, "other")).toBe(false);
    expect(isActive(reelsTab, DEFAULTS, "other")).toBe(true);
    expect(isActive(reelsTab, settings({ hideReelsTab: false }), "home")).toBe(
      false,
    );
  });
});
