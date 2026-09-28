import { describe, expect, it } from "vitest";
import { buildCss } from "../../src/core/css";
import { DEFAULTS, type Settings } from "../../src/core/settings";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULTS,
  ...overrides,
});
const lines = (s: Settings) => buildCss(s).trim().split("\n");

describe("buildCss", () => {
  it("always hides marked elements (C7: attribute plus stylesheet, not inline styles)", () => {
    const allOff = settings({
      hideReelsTab: false,
      hideExploreTab: false,
      hideStories: false,
      hideFeedReels: false,
      hideSuggested: false,
    });
    expect(lines(allOff)).toEqual([
      "[data-anti-doom-hidden] { display: none !important; }",
    ]);
  });

  it("hides the Reels tab by href", () => {
    expect(lines(DEFAULTS)).toContain(
      'a[href="/reels/"] { display: none !important; }',
    );
    expect(lines(DEFAULTS)).toContain(
      'a[href^="/reels/"]:not([href^="/reels/audio/"]) { display: none !important; }',
    );
  });

  it("scopes feed Reels to the home route", () => {
    expect(lines(DEFAULTS)).toContain(
      'html[data-anti-doom-route="home"] main article:has(a[href^="/reel/"]) { display: none !important; }',
    );
  });

  it("leaves out disabled rules", () => {
    const css = buildCss(
      settings({ hideReelsTab: false, hideFeedReels: false }),
    );
    expect(css).not.toContain("/reels/");
    expect(css).not.toContain("/reel/");
  });

  it("puts one selector on each line", () => {
    for (const line of lines(
      settings({ mode: "messagesOnly", hideSearch: true }),
    )) {
      expect(line).toMatch(/^[^,{]+ \{ display: none !important; \}$/);
    }
  });

  it("produces selectors the browser accepts", () => {
    const style = document.createElement("style");
    style.textContent = buildCss(
      settings({ mode: "messagesOnly", hideSearch: true }),
    );
    document.head.append(style);
    const rules = [...(style.sheet?.cssRules ?? [])].map(
      (rule) => rule.cssText,
    );
    style.remove();
    expect(rules.length).toBe(
      lines(settings({ mode: "messagesOnly", hideSearch: true })).length,
    );
  });
});
