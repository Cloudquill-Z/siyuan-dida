import { describe, expect, test } from "vitest";
import { localAllDayStart } from "./date";

describe("localAllDayStart", () => {
  test("formats the local date at midnight with timezone offset", () => {
    expect(localAllDayStart(new Date(2026, 6, 2, 16, 30))).toMatch(/^2026-07-02T00:00:00[+-]\d{4}$/);
  });
});
