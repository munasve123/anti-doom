import { describe, expect, it } from "vitest";

// Placeholder until the core modules land. Confirms the jsdom environment is wired up.
describe("unit test harness", () => {
  it("runs in jsdom", () => {
    document.body.append(document.createElement("main"));
    expect(document.querySelector("main")).not.toBeNull();
  });
});
