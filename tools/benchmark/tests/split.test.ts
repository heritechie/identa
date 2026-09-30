import { describe, expect, it } from "vitest";
import {
  filterPairsBySplit,
  splitPersons,
  type PersonSplitMap,
  type Split,
} from "../src/split.js";
import type { Pair } from "../src/pairs.js";

const ids = ["alpha", "bravo", "charlie", "delta", "echo"];

function pair(
  personA: string,
  personB: string,
  label: "positive" | "negative",
): Pair {
  return {
    type: "ktp_selfie",
    label,
    personA,
    personB,
    imageA: "",
    imageB: "",
  };
}

describe("splitPersons", () => {
  it("returns a deterministic assignment for the same seed", () => {
    const a = splitPersons(ids, { seed: 42 });
    const b = splitPersons(ids, { seed: 42 });
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it("different seeds produce different assignments", () => {
    const a = splitPersons(ids, { seed: 1 });
    const b = splitPersons(ids, { seed: 999 });
    expect([...a.entries()].sort()).not.toEqual([...b.entries()].sort());
  });

  it("assigns every person to exactly one split (person-disjoint)", () => {
    const map = splitPersons(ids, { seed: 7 });
    const seen = new Set<string>();
    for (const id of ids) {
      expect(map.has(id)).toBe(true);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it("only uses splits requested via the splits option", () => {
    const map = splitPersons(ids, { seed: 7, splits: ["test"] });
    for (const value of map.values()) {
      expect(value).toBe("test");
    }
  });

  it("honors approximate ratios", () => {
    const many = Array.from({ length: 100 }, (_, i) =>
      `p${i.toString().padStart(3, "0")}`,
    );
    const map = splitPersons(many, {
      seed: 123,
      ratios: [0.7, 0.15, 0.15],
    });
    const counts: Record<Split, number> = { train: 0, dev: 0, test: 0 };
    for (const v of map.values()) counts[v]++;
    expect(counts.train).toBeGreaterThan(60);
    expect(counts.train).toBeLessThan(80);
    expect(counts.dev).toBeGreaterThanOrEqual(5);
    expect(counts.dev).toBeLessThan(30);
    expect(counts.test).toBeGreaterThanOrEqual(5);
    expect(counts.test).toBeLessThan(30);
  });

  it("handles empty input", () => {
    const map = splitPersons([], { seed: 0 });
    expect(map.size).toBe(0);
  });

  it("ignores input ordering (sorted internally)", () => {
    const reversed = [...ids].reverse();
    const a = splitPersons(ids, { seed: 5 });
    const b = splitPersons(reversed, { seed: 5 });
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it("normalizes zero ratios and falls back to defaults", () => {
    const map = splitPersons(ids, {
      seed: 11,
      ratios: [0, 0, 0],
    });
    expect(map.size).toBe(ids.length);
  });

  it("single-split mode assigns all persons to that split", () => {
    const map = splitPersons(ids, { seed: 3, splits: ["test"] });
    const unique = new Set(map.values());
    expect(unique.size).toBe(1);
    expect(unique.has("test")).toBe(true);
  });
});

describe("filterPairsBySplit", () => {
  const pairs: ReadonlyArray<Pair> = [
    pair("a", "a", "positive"),
    pair("b", "b", "positive"),
    pair("a", "b", "negative"),
    pair("b", "a", "negative"),
    pair("a", "c", "negative"),
  ];

  it("returns only pairs whose both persons are in the requested split", () => {
    const map: PersonSplitMap = new Map([
      ["a", "test"],
      ["b", "train"],
      ["c", "test"],
    ]);
    const testPairs = filterPairsBySplit(pairs, map, "test");
    expect(testPairs.map((p) => `${p.personA}-${p.personB}`)).toEqual([
      "a-a",
      "a-c",
    ]);
  });

  it("returns empty when no person falls in the split", () => {
    const map: PersonSplitMap = new Map([
      ["a", "train"],
      ["b", "train"],
      ["c", "train"],
    ]);
    expect(filterPairsBySplit(pairs, map, "test")).toEqual([]);
  });
});
