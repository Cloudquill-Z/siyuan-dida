import { describe, expect, test } from "vitest";
import { setSyncTooltip } from "./syncTooltip";

describe("setSyncTooltip", () => {
  test("writes the sync status to the top-bar hover attributes", () => {
    const attributes = new Map<string, string>();
    const button = {
      setAttribute(name: string, value: string) {
        attributes.set(name, value);
      }
    } as HTMLElement;

    setSyncTooltip(button, "滴答：12:34:56 已同步");

    expect(attributes.get("aria-label")).toBe("滴答：12:34:56 已同步");
    expect(attributes.get("data-tooltip")).toBe("滴答：12:34:56 已同步");
  });
});
