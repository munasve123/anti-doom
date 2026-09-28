import { beforeEach, describe, expect, it } from "vitest";
import { labelsFor } from "../../src/core/locale";
import {
  HIDDEN_ATTR,
  probe,
  runPasses,
  unmarkAll,
  type PassContext,
} from "../../src/core/passes";
import type { Route } from "../../src/core/rules";
import { DEFAULTS, type Settings } from "../../src/core/settings";

// Hand-built DOM shaped like Instagram's mobile home page. Real captures replace these later.
const TAB_BAR = `
  <nav>
    <a id="tab-home" href="/"><svg aria-label="Home"></svg></a>
    <a id="tab-search" href="/explore/"><svg aria-label="Search"></svg></a>
    <a id="tab-reels" href="/reels/"><svg aria-label="Reels"></svg></a>
    <a id="tab-direct" href="/direct/inbox/"><svg aria-label="Direct"></svg></a>
    <div id="tab-create" role="button"><svg aria-label="New post"></svg></div>
  </nav>`;

const post = (id: string, permalink: string, header = "", body = "") => `
  <article id="${id}">
    <header><a href="/user_${id}/">user</a>${header}</header>
    <a href="${permalink}">media</a>${body}
  </article>`;

const HOME = `
  ${TAB_BAR}
  <main>
    <div id="tray"><div><ul>
      <li><a href="/stories/a/">a</a></li>
      <li><a href="/stories/b/">b</a></li>
    </ul></div></div>
    <div id="feed">
      ${post("photo", "/p/1/")}
      ${post("reel", "/reel/2/")}
      ${post("suggested", "/p/3/", '<div role="button">Follow</div>')}
      ${post("labelled", "/p/4/", "<span>Suggested for you</span>")}
      ${post("music", "/p/5/", '<a href="/reels/audio/9/">Song</a><svg aria-label="Audio image"></svg>')}
      ${post("caption", "/p/6/", "", "<span>Not suggested for you, just a caption</span>")}
      ${post("avatar-story", "/p/7/", '<a href="/stories/dave/">dave</a>')}
      ${post("carousel", "/p/8/", "", '<div role="button" aria-label="Next"></div>')}
    </div>
  </main>`;

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULTS,
  ...overrides,
});

function context(
  overrides: Partial<Settings> = {},
  route: Route = "home",
): PassContext {
  return {
    document,
    settings: settings(overrides),
    labels: labelsFor(document),
    route,
  };
}

const byId = (id: string) => document.getElementById(id)!;
const isHidden = (id: string) => byId(id).hasAttribute(HIDDEN_ATTR);
const hiddenIds = () =>
  [...document.querySelectorAll(`[${HIDDEN_ATTR}]`)].map(
    (el) => el.id || el.tagName,
  );

function load(html: string, lang = "en") {
  document.documentElement.setAttribute("lang", lang);
  document.body.innerHTML = html;
}

beforeEach(() => load(HOME));

describe("home feed with default settings", () => {
  it("hides the tray, Reels, and suggested posts, and nothing else", () => {
    runPasses(context());
    expect(hiddenIds().sort()).toEqual([
      "labelled",
      "reel",
      "suggested",
      "tab-reels",
      "tray",
    ]);
  });

  it("marks with an attribute, never an inline style (C7)", () => {
    runPasses(context());
    expect(document.querySelectorAll("[style]")).toHaveLength(0);
    expect(byId("reel").getAttribute(HIDDEN_ATTR)).toBe("feed.reels");
  });

  it("reports what matched, for health", () => {
    const { matches } = runPasses(context());
    expect(matches).toEqual(
      expect.arrayContaining([
        { rule: "nav.reels", strategy: 0 },
        { rule: "feed.stories", strategy: 0 },
        { rule: "feed.reels", strategy: 1 },
        { rule: "feed.suggested", strategy: 0 },
      ]),
    );
  });

  it("is idempotent", () => {
    runPasses(context());
    const first = hiddenIds();
    runPasses(context());
    expect(hiddenIds()).toEqual(first);
  });
});

describe("story tray (C1)", () => {
  it("never runs off the home route, so a profile's story ring stays", () => {
    load(`${TAB_BAR}<main><header id="profile-header">
      <a href="/stories/someone/"><img></a><h2>someone</h2></header>
      <div id="grid"><a href="/p/1/">post</a></div></main>`);
    runPasses(context({}, "other"));
    expect(isHidden("profile-header")).toBe(false);
    expect(hiddenIds()).not.toContain("grid");
  });

  it("ignores story links inside posts", () => {
    byId("tray").remove();
    runPasses(context());
    expect(
      byId("avatar-story").querySelectorAll(`[${HIDDEN_ATTR}]`),
    ).toHaveLength(0);
    expect(hiddenIds().sort()).toEqual([
      "labelled",
      "reel",
      "suggested",
      "tab-reels",
    ]);
  });

  it("stops climbing before anything that holds posts, even without article elements", () => {
    load(`<main>
      <div id="wrapper">
        <div id="tray"><a href="/stories/a/">a</a><a href="/stories/b/">b</a></div>
        <div id="posts"><div><a href="/p/1/">post</a></div></div>
      </div></main>`);
    runPasses(context());
    expect(hiddenIds()).toEqual(["tray"]);
  });

  it("hides nothing when a story link's own parent already holds posts", () => {
    load(
      `<main><div id="mixed"><a href="/stories/a/">a</a><a href="/p/1/">post</a></div></main>`,
    );
    runPasses(context());
    expect(hiddenIds()).toEqual([]);
  });
});

describe("feed Reels", () => {
  it("keeps a photo post with music visible (C3)", () => {
    runPasses(context());
    expect(isHidden("music")).toBe(false);
  });

  it("catches reel links under a username path", () => {
    byId("photo")
      .querySelector('a[href="/p/1/"]')!
      .setAttribute("href", "/someone/reel/1/");
    runPasses(context());
    expect(isHidden("photo")).toBe(true);
  });

  it("re-evaluates a recycled node when its permalink changes (C5)", () => {
    runPasses(context());
    expect(isHidden("reel")).toBe(true);
    byId("reel")
      .querySelector('a[href="/reel/2/"]')!
      .setAttribute("href", "/p/99/");
    runPasses(context());
    expect(isHidden("reel")).toBe(false);
  });
});

describe("suggested posts (C4)", () => {
  it("uses the header's Follow button first", () => {
    const { matches } = runPasses(context());
    expect(isHidden("suggested")).toBe(true);
    expect(matches).toContainEqual({ rule: "feed.suggested", strategy: 0 });
  });

  it("falls back to the header label", () => {
    byId("suggested").remove();
    const { matches } = runPasses(context());
    expect(isHidden("labelled")).toBe(true);
    expect(matches).toContainEqual({ rule: "feed.suggested", strategy: 1 });
  });

  it("never reads the caption", () => {
    runPasses(context());
    expect(isHidden("caption")).toBe(false);
  });

  it("ignores Follow buttons outside the header", () => {
    load(
      `<main>${post("tagged", "/p/1/", "", '<div role="button">Follow</div>')}</main>`,
    );
    runPasses(context());
    expect(isHidden("tagged")).toBe(false);
  });
});

describe("navigation", () => {
  it("hides tabs by label when the href changes, and reports the backup strategy", () => {
    byId("tab-reels").setAttribute("href", "/clips/");
    const { matches } = runPasses(context());
    expect(isHidden("tab-reels")).toBe(true);
    expect(matches).toContainEqual({ rule: "nav.reels", strategy: 2 });
  });

  it("leaves labelled links inside main alone, such as a profile's Reels tab", () => {
    load(`${TAB_BAR}<main><a id="profile-reels" href="/someone/reels/">
      <svg aria-label="Reels"></svg></a></main>`);
    runPasses(context({}, "other"));
    expect(isHidden("profile-reels")).toBe(false);
  });

  it("hides the shared search tab only once search is hidden too (C10)", () => {
    runPasses(context({ hideExploreTab: true, hideSearch: false }));
    expect(isHidden("tab-search")).toBe(false);
    runPasses(context({ hideExploreTab: true, hideSearch: true }));
    expect(isHidden("tab-search")).toBe(true);
  });

  it("hides posting and every other tab but messages in messages-only mode", () => {
    runPasses(context({ mode: "messagesOnly" }, "other"));
    expect(isHidden("tab-create")).toBe(true);
    expect(isHidden("tab-search")).toBe(true);
    expect(isHidden("tab-direct")).toBe(false);
  });
});

describe("robustness", () => {
  it("re-evaluates a marked tab when React reuses it for another destination", () => {
    byId("tab-reels").setAttribute("href", "/clips/");
    runPasses(context());
    expect(isHidden("tab-reels")).toBe(true);
    const tab = byId("tab-reels");
    tab.setAttribute("href", "/direct/inbox/");
    tab.querySelector("svg")!.setAttribute("aria-label", "Direct");
    runPasses(context());
    expect(isHidden("tab-reels")).toBe(false);
  });

  it("treats a selector the engine rejects as no match instead of throwing", () => {
    expect(probe(document, "a[")).toBe(false);
    expect(probe(document, "main")).toBe(true);
  });
});

describe("unknown language", () => {
  it("keeps href and structural strategies, and drops label ones", () => {
    load(HOME, "fr");
    runPasses(context());
    expect(hiddenIds().sort()).toEqual(["reel", "tray"]);
  });
});

describe("feed limit", () => {
  const feedOf = (count: number) =>
    `<main><div id="feed">${Array.from({ length: count }, (_, i) => post(`p${i}`, `/p/${i}/`)).join("")}</div></main>`;

  it("hides posts after the limit and reports it was reached", () => {
    load(feedOf(8));
    const { feed } = runPasses(context({ feedLimit: 5 }));
    expect(hiddenIds()).toEqual(["p5", "p6", "p7"]);
    expect(feed).toEqual({ shown: 5, reached: true });
  });

  it("doesn't count posts hidden for other reasons", () => {
    const { feed } = runPasses(context({ feedLimit: 5 }));
    expect(feed).toEqual({ shown: 5, reached: true });
    expect(isHidden("carousel")).toBe(false);
    load(HOME);
    runPasses(
      context({ feedLimit: 5, hideSuggested: false, hideFeedReels: false }),
    );
    expect(isHidden("caption")).toBe(true);
  });

  it("hides posts appended later", () => {
    load(feedOf(5));
    runPasses(context({ feedLimit: 5 }));
    byId("feed").insertAdjacentHTML("beforeend", post("late", "/p/late/"));
    runPasses(context({ feedLimit: 5 }));
    expect(isHidden("late")).toBe(true);
  });

  it("reports not reached below the limit", () => {
    load(feedOf(3));
    expect(runPasses(context({ feedLimit: 5 })).feed).toEqual({
      shown: 3,
      reached: false,
    });
  });

  it("lets a post through again when the limit rises", () => {
    load(feedOf(8));
    runPasses(context({ feedLimit: 5 }));
    runPasses(context({ feedLimit: 10 }));
    expect(hiddenIds()).toEqual([]);
  });

  it("turns a limit-hidden Reel into a Reel mark", () => {
    load(feedOf(6));
    runPasses(context({ feedLimit: 5, hideFeedReels: false }));
    byId("p5")
      .querySelector("a[href='/p/5/']")!
      .setAttribute("href", "/reel/5/");
    runPasses(context({ feedLimit: 5 }));
    expect(byId("p5").getAttribute(HIDDEN_ATTR)).toBe("feed.reels");
  });
});

describe("unmarking", () => {
  it("unmarks a rule's elements when it's turned off", () => {
    runPasses(context());
    runPasses(context({ hideFeedReels: false }));
    expect(isHidden("reel")).toBe(false);
    expect(isHidden("tray")).toBe(true);
  });

  it("keeps home marks when leaving home, so returning doesn't flash", () => {
    runPasses(context());
    runPasses(context({}, "other"));
    expect(isHidden("tray")).toBe(true);
  });

  it("unmarks values it doesn't recognise", () => {
    byId("photo").setAttribute(HIDDEN_ATTR, "old.rule");
    runPasses(context());
    expect(isHidden("photo")).toBe(false);
  });

  it("unmarkAll clears every mark", () => {
    runPasses(context());
    unmarkAll(document);
    expect(hiddenIds()).toEqual([]);
  });
});
