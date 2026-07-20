import { describe, expect, test } from "vitest";
import { createTranslator } from "./i18n";

describe("createTranslator", () => {
  test("uses Simplified Chinese for a zh-CN locale", () => {
    const t = createTranslator("zh-CN");

    expect(t("saveSettings")).toBe("保存设置");
  });

  test("uses English and interpolates dynamic values for other locales", () => {
    const t = createTranslator("en-US");

    expect(t("syncComplete", { summary: "1 created" })).toBe("Dida sync complete: 1 created");
  });
});
