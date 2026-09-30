import { describe, expect, it } from "vitest";
import {
  countByLabel,
  generatePairs,
  type Pair,
} from "../src/pairs.js";
import { buildDataset, type DatasetPerson } from "../src/dataset.js";

const person = (id: string): DatasetPerson => ({
  id,
  images: {
    ktp: `/data/${id}/ktp.jpg`,
    selfie: `/data/${id}/selfie.jpg`,
  },
});

const fixture: ReadonlyArray<DatasetPerson> = [
  person("a"),
  person("b"),
  person("c"),
];

describe("generatePairs", () => {
  it("produces one positive pair per person (KTP ↔ selfie)", () => {
    const pairs = generatePairs(fixture);
    const positives = pairs.filter((p) => p.label === "positive");
    expect(positives).toHaveLength(fixture.length);
    for (const p of positives) {
      expect(p.personA).toBe(p.personB);
      expect(p.type).toBe("ktp_selfie");
    }
  });

  it("produces N*(N-1) negative pairs when symmetric (default)", () => {
    const pairs = generatePairs(fixture);
    const negatives = pairs.filter((p) => p.label === "negative");
    expect(negatives).toHaveLength(fixture.length * (fixture.length - 1));
  });

  it("produces N*(N-1)/2 negative pairs when asymmetric", () => {
    const pairs = generatePairs(fixture, { symmetricNegatives: false });
    const negatives = pairs.filter((p) => p.label === "negative");
    expect(negatives).toHaveLength((fixture.length * (fixture.length - 1)) / 2);
  });

  it("never produces a same-person negative pair", () => {
    const pairs = generatePairs(fixture);
    for (const p of pairs) {
      if (p.label === "negative") {
        expect(p.personA).not.toBe(p.personB);
      }
    }
  });

  it("covers every ordered pair of distinct persons in symmetric mode", () => {
    const pairs = generatePairs(fixture);
    const seen = new Set<string>();
    for (const p of pairs) {
      if (p.label === "negative") {
        seen.add(`${p.personA}->${p.personB}`);
      }
    }
    expect(seen.size).toBe(fixture.length * (fixture.length - 1));
  });

  it("is deterministic for the same input", () => {
    const a = generatePairs(fixture);
    const b = generatePairs(fixture);
    expect(a).toEqual(b);
  });

  it("order is deterministic regardless of input person order", () => {
    const shuffled = [fixture[2], fixture[0], fixture[1]] as const;
    const a = generatePairs(fixture);
    const b = generatePairs(shuffled);
    expect(a.map((p) => p.personA + p.personB)).toEqual(
      b.map((p) => p.personA + p.personB),
    );
  });

  it("returns frozen arrays", () => {
    const pairs = generatePairs(fixture);
    expect(Object.isFrozen(pairs)).toBe(true);
  });

  it("links each pair to its concrete image paths", () => {
    const pairs = generatePairs(fixture);
    const firstPositive = pairs.find(
      (p) => p.label === "positive" && p.personA === "a",
    );
    expect(firstPositive?.imageA).toBe("/data/a/ktp.jpg");
    expect(firstPositive?.imageB).toBe("/data/a/selfie.jpg");
  });

  it("countByLabel reports positive and negative totals", () => {
    const pairs = generatePairs(fixture);
    expect(countByLabel(pairs)).toEqual({
      positive: 3,
      negative: 6,
    });
  });

  it("works with a dataset built via buildDataset", () => {
    const dataset = buildDataset("/private/data", fixture);
    const pairs: ReadonlyArray<Pair> = generatePairs(dataset.persons);
    expect(pairs.length).toBe(3 + 6);
  });
});
