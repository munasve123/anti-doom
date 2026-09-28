// The rule catalogue, as data. Each rule lists its strategies in priority order: href selectors
// first, then locale labels, then structural passes. Instagram A/B tests its markup, so add
// strategies rather than replacing them. The URL guard's rules live in guard.ts.
import type { LabelKey } from "./locale";
import type { Settings } from "./settings";

export type RuleId =
  | "nav.reels"
  | "nav.explore"
  | "nav.search"
  | "nav.notifications"
  | "nav.create"
  | "feed.stories"
  | "feed.reels"
  | "feed.suggested"
  | "feed.limit";

export type Route = "home" | "other";

export type StructuralPass =
  "storyTray" | "feedReels" | "followButton" | "suggestedLabel" | "feedLimit";

export type Strategy =
  /** A single CSS selector. Goes into the stylesheet, so it hides before paint. */
  | { kind: "css"; selector: string }
  /**
   * Elements whose aria-label is one of the locale's labels, climbing to the closest target.
   * Skips anything inside main, where the same icons appear in content, such as a profile's
   * own Reels tab.
   */
  | { kind: "label"; label: LabelKey; target: string }
  /** A JavaScript pass in passes.ts. */
  | { kind: "structural"; pass: StructuralPass };

/**
 * structural: expected on every home page view. "Not seen lately" after staleAfter misses in a row.
 * content: legitimately absent some days, so only "last seen" is shown.
 */
export type HealthPolicy =
  | { kind: "structural"; staleAfter: number }
  | { kind: "content" }
  | { kind: "none" };

export interface Rule {
  id: RuleId;
  enabled(settings: Settings): boolean;
  /** Runs only on the home feed, and its CSS is scoped to it. */
  homeOnly: boolean;
  health: HealthPolicy;
  strategies: readonly Strategy[];
}

/** Attribute on <html> naming the current route, which home-only CSS is scoped to. */
export const ROUTE_ATTR = "data-anti-doom-route";

const LINK = 'a, [role="link"]';
const LINK_OR_BUTTON = 'a, [role="link"], button, [role="button"]';
const STRUCTURAL: HealthPolicy = { kind: "structural", staleAfter: 5 };
const CONTENT: HealthPolicy = { kind: "content" };

const messagesOnly = (s: Settings) => s.mode === "messagesOnly";

export const RULES: readonly Rule[] = [
  {
    id: "nav.reels",
    enabled: (s) => s.hideReelsTab || messagesOnly(s),
    homeOnly: false,
    health: STRUCTURAL,
    strategies: [
      { kind: "css", selector: 'a[href="/reels/"]' },
      // Not /reels/audio/, which is the music credit inside ordinary posts.
      {
        kind: "css",
        selector: 'a[href^="/reels/"]:not([href^="/reels/audio/"])',
      },
      { kind: "label", label: "reels", target: LINK },
    ],
  },
  {
    id: "nav.explore",
    // On mobile web the Explore tab is also the way into search (C10), so it stays while search
    // is allowed. The guard sends /explore/ to /explore/search/ instead.
    enabled: (s) => (s.hideExploreTab && s.hideSearch) || messagesOnly(s),
    homeOnly: false,
    health: STRUCTURAL,
    strategies: [
      { kind: "css", selector: 'a[href="/explore/"]' },
      { kind: "label", label: "explore", target: LINK },
    ],
  },
  {
    id: "nav.search",
    enabled: (s) => s.hideSearch || messagesOnly(s),
    homeOnly: false,
    health: STRUCTURAL,
    strategies: [
      { kind: "css", selector: 'a[href^="/explore/search"]' },
      { kind: "label", label: "search", target: LINK },
    ],
  },
  {
    id: "nav.notifications",
    enabled: (s) => s.hideNotifications || messagesOnly(s),
    homeOnly: false,
    health: STRUCTURAL,
    strategies: [
      { kind: "css", selector: 'a[href="/accounts/activity/"]' },
      { kind: "label", label: "notifications", target: LINK_OR_BUTTON },
    ],
  },
  {
    id: "nav.create",
    enabled: messagesOnly,
    homeOnly: false,
    health: { kind: "none" },
    strategies: [{ kind: "label", label: "newPost", target: LINK_OR_BUTTON }],
  },
  {
    id: "feed.stories",
    enabled: (s) => s.hideStories,
    homeOnly: true,
    // Tolerant: an empty tray is normal, so it takes five home views without one to go stale.
    health: STRUCTURAL,
    strategies: [{ kind: "structural", pass: "storyTray" }],
  },
  {
    id: "feed.reels",
    enabled: (s) => s.hideFeedReels,
    homeOnly: true,
    health: CONTENT,
    strategies: [
      { kind: "css", selector: 'main article:has(a[href^="/reel/"])' },
      { kind: "structural", pass: "feedReels" },
    ],
  },
  {
    id: "feed.suggested",
    enabled: (s) => s.hideSuggested,
    homeOnly: true,
    health: CONTENT,
    strategies: [
      { kind: "structural", pass: "followButton" },
      { kind: "structural", pass: "suggestedLabel" },
    ],
  },
  {
    id: "feed.limit",
    enabled: (s) => s.feedLimit > 0,
    homeOnly: true,
    health: { kind: "none" },
    strategies: [{ kind: "structural", pass: "feedLimit" }],
  },
];

const BY_ID = new Map<string, Rule>(RULES.map((rule) => [rule.id, rule]));

export function ruleById(id: string): Rule | undefined {
  return BY_ID.get(id);
}

export function routeOf(pathname: string): Route {
  return pathname === "/" ? "home" : "other";
}

export function isActive(
  rule: Rule,
  settings: Settings,
  route: Route,
): boolean {
  return rule.enabled(settings) && (!rule.homeOnly || route === "home");
}
