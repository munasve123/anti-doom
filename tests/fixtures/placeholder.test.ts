import { describe, expect, it } from "vitest";

// Placeholder until fixtures land. Confirms data-expect marks can be queried.
describe("fixture test harness", () => {
  it("finds data-expect marks", () => {
    const main = document.createElement("main");
    main.append(document.createElement("article"));
    main.firstElementChild?.setAttribute("data-expect", "visible");
    document.body.append(main);
    expect(document.querySelectorAll('[data-expect="visible"]')).toHaveLength(1);
  });
});
