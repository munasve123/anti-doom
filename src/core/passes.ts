// The JavaScript layer: what CSS can't express. Climbing to ancestors, header checks, and the
// feed limit. Passes only ever set or remove Anti-Doom's own attributes. They never move,
// remove, or restyle Instagram's nodes, and they never read text outside a post's header.
import type { Labels } from "./locale";
import {
  RULES,
  isActive,
  ruleById,
  type Route,
  type Rule,
  type RuleId,
  type Strategy,
  type StructuralPass,
} from "./rules";
import type { Settings } from "./settings";

/** Marks an element hidden. The value is the rule that hid it. The stylesheet does the hiding. */
export const HIDDEN_ATTR = "data-anti-doom-hidden";
/** The permalink a marked post had when it was marked, so a recycled node is re-evaluated. */
export const KEY_ATTR = "data-anti-doom-key";

export interface PassContext {
  document: Document;
  settings: Settings;
  /** The locale's labels, or null for an unknown language (label strategies are skipped). */
  labels: Labels | null;
  route: Route;
}

/** A rule that matched on this pass, and the index of the first strategy that matched. */
export interface Match {
  rule: RuleId;
  strategy: number;
}

export interface FeedState {
  /** Posts left visible by the feed limit. */
  shown: number;
  /** True once the feed has at least as many posts as the limit, so the end card should show. */
  reached: boolean;
}

export interface PassResult {
  matches: Match[];
  /** Null when the feed limit isn't active. */
  feed: FeedState | null;
}

const PERMALINK = 'a[href*="/p/"], a[href*="/reel/"]';
const HOLDS_POSTS = `article, ${PERMALINK}`;
const REEL_LINK = 'a[href*="/reel/"]';
const BUTTON = 'button, [role="button"]';

function keyOf(element: Element): string {
  if (element.tagName !== "ARTICLE") return "";
  return element.querySelector(PERMALINK)?.getAttribute("href") ?? "";
}

function mark(element: Element, rule: RuleId): void {
  element.setAttribute(HIDDEN_ATTR, rule);
  element.setAttribute(KEY_ATTR, keyOf(element));
}

function unmark(element: Element): void {
  element.removeAttribute(HIDDEN_ATTR);
  element.removeAttribute(KEY_ATTR);
}

function markedAs(element: Element): string | null {
  return element.getAttribute(HIDDEN_ATTR);
}

export function unmarkAll(document: Document): void {
  for (const element of document.querySelectorAll(`[${HIDDEN_ATTR}]`))
    unmark(element);
}

/**
 * Removes marks whose rule is unknown or turned off, and marks on posts whose permalink has
 * changed because Instagram reused the node (C5). Marks from home-only rules survive leaving
 * home, so going back doesn't flash hidden content.
 */
function reconcile(context: PassContext): void {
  for (const element of context.document.querySelectorAll(`[${HIDDEN_ATTR}]`)) {
    const rule = ruleById(markedAs(element) ?? "");
    const stale = element.getAttribute(KEY_ATTR) !== keyOf(element);
    if (!rule || !rule.enabled(context.settings) || stale) unmark(element);
  }
}

function feedArticles(document: Document): Element[] {
  const main = document.querySelector("main");
  return main ? [...main.querySelectorAll("article")] : [];
}

/** True if a content rule may mark this post: it's unmarked, or only hidden by the feed limit. */
function claimable(article: Element): boolean {
  const current = markedAs(article);
  return current === null || current === "feed.limit";
}

function quote(text: string): string {
  return `"${text.replace(/["\\]/g, "\\$&")}"`;
}

function labelTargets(
  document: Document,
  labels: Labels,
  strategy: Extract<Strategy, { kind: "label" }>,
): Element[] {
  const targets: Element[] = [];
  for (const text of labels[strategy.label]) {
    for (const element of document.querySelectorAll(
      `[aria-label=${quote(text)}]`,
    )) {
      if (element.closest("main")) continue;
      const target = element.closest(strategy.target);
      if (target) targets.push(target);
    }
  }
  return targets;
}

/** The story tray: home only, and only from a story link outside any post (C1). */
function storyTray(context: PassContext, rule: Rule): boolean {
  const main = context.document.querySelector("main");
  const link = [...(main?.querySelectorAll('a[href^="/stories/"]') ?? [])].find(
    (candidate) => !candidate.closest("article"),
  );
  if (!main || !link) return false;

  // Climb to the largest ancestor that holds no posts, stopping below main.
  let node: Element = link;
  while (
    node.parentElement &&
    node.parentElement !== main &&
    !node.parentElement.querySelector(HOLDS_POSTS)
  ) {
    node = node.parentElement;
  }
  if (node === link) return false;
  if (markedAs(node) === null) mark(node, rule.id);
  return true;
}

/** Marks posts that pass test. Counts posts this rule already hid as matches too. */
function markPosts(
  context: PassContext,
  rule: Rule,
  test: (article: Element) => boolean,
): boolean {
  let matched = false;
  for (const article of feedArticles(context.document)) {
    if (markedAs(article) === rule.id) {
      matched = true;
    } else if (claimable(article) && test(article)) {
      mark(article, rule.id);
      matched = true;
    }
  }
  return matched;
}

/** A post's header, and never its caption or comments (C4). */
function headerOf(article: Element): Element | null {
  return article.querySelector("header");
}

function hasFollowButton(article: Element, labels: Labels): boolean {
  const buttons = headerOf(article)?.querySelectorAll(BUTTON) ?? [];
  return [...buttons].some((button) =>
    labels.follow.includes(button.textContent?.trim() ?? ""),
  );
}

function hasSuggestedLabel(article: Element, labels: Labels): boolean {
  const text = headerOf(article)?.textContent?.toLowerCase() ?? "";
  return labels.suggested.some((label) => text.includes(label.toLowerCase()));
}

/** Keeps the first feedLimit visible posts, and marks the rest (C6: nothing is inserted). */
function feedLimit(context: PassContext, rule: Rule): FeedState {
  const limit = context.settings.feedLimit;
  let shown = 0;
  let total = 0;
  for (const article of feedArticles(context.document)) {
    const current = markedAs(article);
    if (current !== null && current !== rule.id) continue;
    total++;
    if (shown < limit) {
      shown++;
      if (current === rule.id) unmark(article);
    } else if (current === null) {
      mark(article, rule.id);
    }
  }
  return { shown, reached: total >= limit };
}

export function runPasses(context: PassContext): PassResult {
  reconcile(context);
  const { document, labels } = context;
  const matches: Match[] = [];
  let feed: FeedState | null = null;

  const structural = (pass: StructuralPass, rule: Rule): boolean => {
    switch (pass) {
      case "storyTray":
        return storyTray(context, rule);
      case "feedReels":
        // Any /reel/ link, including /<username>/reel/<id>/. The "Audio image" icon is
        // deliberately not a signal: photo posts with music carry it too (C3).
        return markPosts(
          context,
          rule,
          (article) => article.querySelector(REEL_LINK) !== null,
        );
      case "followButton":
        return (
          labels !== null &&
          markPosts(context, rule, (a) => hasFollowButton(a, labels))
        );
      case "suggestedLabel":
        return (
          labels !== null &&
          markPosts(context, rule, (a) => hasSuggestedLabel(a, labels))
        );
      case "feedLimit":
        feed = feedLimit(context, rule);
        return feed.reached;
    }
  };

  for (const rule of RULES) {
    if (!isActive(rule, context.settings, context.route)) continue;
    let first = -1;
    rule.strategies.forEach((strategy, index) => {
      let hit = false;
      if (strategy.kind === "css") {
        // The stylesheet does the hiding. Probe only where health needs the answer.
        hit =
          rule.health.kind === "structural" &&
          document.querySelector(strategy.selector) !== null;
      } else if (strategy.kind === "label") {
        const targets = labels ? labelTargets(document, labels, strategy) : [];
        for (const target of targets)
          if (markedAs(target) === null) mark(target, rule.id);
        hit = targets.length > 0;
      } else {
        hit = structural(strategy.pass, rule);
      }
      if (hit && first < 0) first = index;
    });
    if (first >= 0 && rule.health.kind !== "none")
      matches.push({ rule: rule.id, strategy: first });
  }

  return { matches, feed };
}
