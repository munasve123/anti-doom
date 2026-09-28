// Builds the stylesheet: the layer that hides whatever a selector can reach, before paint and
// with no JavaScript cost. One selector per rule, so a selector a browser rejects only drops
// that one rule.
import { HIDDEN_ATTR } from "./passes";
import { ROUTE_ATTR, RULES } from "./rules";
import type { Settings } from "./settings";

const HIDE = "{ display: none !important; }";

export function buildCss(settings: Settings): string {
  const lines = [`[${HIDDEN_ATTR}] ${HIDE}`];
  for (const rule of RULES) {
    if (!rule.enabled(settings)) continue;
    const scope = rule.homeOnly ? `html[${ROUTE_ATTR}="home"] ` : "";
    for (const strategy of rule.strategies) {
      if (strategy.kind === "css")
        lines.push(`${scope}${strategy.selector} ${HIDE}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
