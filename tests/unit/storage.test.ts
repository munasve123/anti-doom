import { describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "../../src/core/storage";

describe("createMemoryStorage", () => {
  it("returns undefined for a missing key", async () => {
    expect(await createMemoryStorage().get("missing")).toBeUndefined();
  });

  it("starts with the initial values", async () => {
    expect(await createMemoryStorage({ a: 1 }).get("a")).toBe(1);
  });

  it("stores and returns values", async () => {
    const storage = createMemoryStorage();
    await storage.set("a", { b: [1, 2] });
    expect(await storage.get("a")).toEqual({ b: [1, 2] });
  });

  it("stores copies, like real storage serialisation", async () => {
    const storage = createMemoryStorage();
    const value = { n: 1 };
    await storage.set("a", value);
    value.n = 2;
    const read = (await storage.get("a")) as { n: number };
    expect(read.n).toBe(1);
    read.n = 3;
    expect(await storage.get("a")).toEqual({ n: 1 });
  });

  it("notifies subscribers of the changed key only", async () => {
    const storage = createMemoryStorage();
    const a = vi.fn();
    const b = vi.fn();
    storage.subscribe("a", a);
    storage.subscribe("b", b);
    await storage.set("a", 1);
    expect(a).toHaveBeenCalledExactlyOnceWith(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", async () => {
    const storage = createMemoryStorage();
    const listener = vi.fn();
    const unsubscribe = storage.subscribe("a", listener);
    unsubscribe();
    await storage.set("a", 1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("gives each subscriber its own copy", async () => {
    const storage = createMemoryStorage();
    storage.subscribe("a", (value) => {
      (value as { n: number }).n = 99;
    });
    const second = vi.fn();
    storage.subscribe("a", second);
    await storage.set("a", { n: 1 });
    expect(second).toHaveBeenCalledWith({ n: 1 });
    expect(await storage.get("a")).toEqual({ n: 1 });
  });

  it("keeps saving and notifying when a subscriber throws", async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      storage.subscribe("a", () => {
        throw new Error("listener bug");
      });
      const second = vi.fn();
      storage.subscribe("a", second);
      await expect(storage.set("a", 1)).resolves.toBeUndefined();
      expect(second).toHaveBeenCalledWith(1);
      expect(await storage.get("a")).toBe(1);
      expect(() => vi.runAllTimers()).toThrow("listener bug");
    } finally {
      vi.useRealTimers();
    }
  });
});
