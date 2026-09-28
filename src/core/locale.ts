// Instagram's UI strings that strategies match against, keyed by language. Adding a language
// means adding a table entry, not code. Every value needs confirming against real captures.

export type LabelKey =
  | "reels"
  | "explore"
  | "search"
  | "notifications"
  | "newPost"
  | "follow"
  | "suggested";

export type Labels = Readonly<Record<LabelKey, readonly string[]>>;

const TABLE: Readonly<Record<string, Labels>> = {
  en: {
    reels: ["Reels"],
    explore: ["Explore"],
    search: ["Search"],
    notifications: ["Notifications"],
    newPost: ["New post"],
    follow: ["Follow"],
    suggested: ["Suggested for you", "Suggested posts"],
  },
};

/** The primary language subtag of the page, lowercased, such as "en" for "en-GB". */
export function detectLanguage(document: Document): string {
  const lang = document.documentElement.getAttribute("lang") ?? "";
  return lang.split("-")[0]!.toLowerCase();
}

/**
 * The label table for the page's language, or null when there isn't one. Null turns off every
 * label and text strategy, leaving the href and structural ones.
 */
export function labelsFor(document: Document): Labels | null {
  return TABLE[detectLanguage(document)] ?? null;
}
