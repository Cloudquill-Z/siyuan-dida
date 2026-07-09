import { describe, expect, test } from "vitest";
import { localAllDayStart } from "./date";

describe("localAllDayStart", () => {
  test("formats only the local calendar date without a time", () => {
    expect(localAllDayStart(new Date(2026, 6, 2, 16, 30))).toBe("2026-07-02");
  });
});
