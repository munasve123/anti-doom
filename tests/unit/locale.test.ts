import { afterEach, describe, expect, it } from "vitest";
import { detectLanguage, labelsFor } from "../../src/core/locale";

afterEach(() => document.documentElement.removeAttribute("lang"));

describe("detectLanguage", () => {
  it.each([
    ["en", "en"],
    ["en-GB", "en"],
    ["EN-us", "en"],
    ["fr", "fr"],
    ["", ""],
  ])("lang=%j -> %j", (lang, expected) => {
    document.documentElement.setAttribute("lang", lang);
    expect(detectLanguage(document)).toBe(expected);
  });

  it("returns an empty string when lang is missing", () => {
    expect(detectLanguage(document)).toBe("");
  });
});

describe("labelsFor (C8: labels come from one table)", () => {
  it("returns the English table for English pages", () => {
    document.documentElement.setAttribute("lang", "en-AU");
    const labels = labelsFor(document);
    expect(labels?.reels).toEqual(["Reels"]);
    expect(labels?.follow).toEqual(["Follow"]);
    expect(labels?.suggested).toContain("Suggested for you");
  });

  it.each(["fr", "", "xx"])(
    "disables label strategies for unknown language %j",
    (lang) => {
      document.documentElement.setAttribute("lang", lang);
      expect(labelsFor(document)).toBeNull();
    },
  );
});
