import { describe, expect, test } from "vitest";
import { formatSyncLogs } from "./logFormat";
import type { SyncResult } from "../core/types";

describe("formatSyncLogs", () => {
  test("includes summary range stats and events", () => {
    const log: SyncResult = {
      created: 1,
      updated: 0,
      completed: 0,
      writtenBack: 0,
      failed: 0,
      skipped: 2,
      scanned: 3,
      rangeResults: [
        {
          rangeId: "range-1",
          rangeName: "工作",
          notebookId: "box-1",
          hpathPrefix: "/工作",
          scanned: 3,
          created: 1,
          updated: 0,
          completed: 0,
          writtenBack: 0,
          failed: 0,
          skipped: 2,
          cursorOffset: 0,
          nextCursorOffset: 200,
          hasMore: true
        }
      ],
      rangeCursorOffsets: { "range-1": 200 },
      events: [{ time: "2026-06-27T01:00:00.000Z", level: "info", message: "创建滴答任务：A" }],
      failures: [],
      startedAt: "2026-06-27T01:00:00.000Z",
      finishedAt: "2026-06-27T01:00:01.000Z"
    };

    const text = formatSyncLogs([log]);

    expect(text).toContain("扫描 3");
    expect(text).toContain("范围 工作");
    expect(text).toContain("下轮从第 201 个继续");
    expect(text).toContain("创建滴答任务：A");
  });
});
