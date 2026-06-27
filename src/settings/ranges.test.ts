import { describe, expect, test } from "vitest";
import { createEmptyRange, prepareRangesForSave } from "./ranges";

describe("createEmptyRange", () => {
  test("creates a default editable range", () => {
    expect(createEmptyRange(2)).toMatchObject({
      id: "range-2",
      name: "同步范围 2",
      includeChildren: true
    });
  });
});

describe("prepareRangesForSave", () => {
  test("drops fully empty draft ranges", () => {
    expect(prepareRangesForSave([createEmptyRange(1)])).toEqual([]);
  });

  test("keeps completed ranges", () => {
    expect(
      prepareRangesForSave([
        {
          ...createEmptyRange(1),
          name: "工作",
          notebookId: "box-1",
          hpathPrefix: "/工作",
          targetProjectId: "project-1",
          targetProjectName: "工作清单"
        }
      ])
    ).toEqual([
      {
        id: "range-1",
        name: "工作",
        notebookId: "box-1",
        hpathPrefix: "/工作",
        includeChildren: true,
        targetProjectId: "project-1",
        targetProjectName: "工作清单"
      }
    ]);
  });

  test("rejects partially configured ranges", () => {
    expect(() =>
      prepareRangesForSave([
        {
          ...createEmptyRange(1),
          name: "工作",
          notebookId: "box-1"
        }
      ])
    ).toThrow("同步范围 1 缺少文档路径");
  });
});
