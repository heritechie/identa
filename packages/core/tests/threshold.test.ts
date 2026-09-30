import { describe, expect, it } from "vitest";
import { applyThreshold, DEFAULT_THRESHOLD } from "../src/threshold.js";

describe("applyThreshold", () => {
  it("returns matched when score meets threshold", () => {
    expect(applyThreshold(0.9, 0.5)).toEqual({
      status: "matched",
      score: 0.9,
      threshold: 0.5,
    });
  });

  it("returns matched when score equals threshold", () => {
    expect(applyThreshold(0.5, 0.5).status).toBe("matched");
  });

  it("returns not_matched when score is below threshold", () => {
    expect(applyThreshold(0.4, 0.5)).toEqual({
      status: "not_matched",
      score: 0.4,
      threshold: 0.5,
    });
  });

  it("uses the documented default threshold when none is provided", () => {
    expect(DEFAULT_THRESHOLD).toBeTypeOf("number");
    expect(applyThreshold(0.3).threshold).toBe(DEFAULT_THRESHOLD);
  });

  it("never returns unable_to_verify from a numeric score", () => {
    expect(applyThreshold(0).status).not.toBe("unable_to_verify");
    expect(applyThreshold(1).status).not.toBe("unable_to_verify");
  });
});
