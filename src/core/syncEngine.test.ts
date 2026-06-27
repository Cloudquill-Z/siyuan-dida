import { describe, expect, test } from "vitest";
import { taskHash } from "./hash";
import { SyncEngine } from "./syncEngine";
import type { DidaGateway, SiYuanGateway, SyncRange, SyncSettings, SiYuanTodoBlock } from "./types";

function settings(): SyncSettings {
  return {
    maxTasksPerRun: 100,
    ranges: [
      {
        id: "range-1",
        name: "工作",
        notebookId: "box-1",
        hpathPrefix: "/工作",
        includeChildren: true,
        targetProjectId: "project-1",
        targetProjectName: "工作"
      }
    ]
  };
}

function block(overrides: Partial<SiYuanTodoBlock>): SiYuanTodoBlock {
  return {
    id: "block-1",
    markdown: "- [ ] 整理会议纪要",
    box: "box-1",
    hpath: "/工作/会议",
    attrs: {},
    ...overrides
  };
}

class FakeSiYuan implements SiYuanGateway {
  public attrs: Array<{ blockId: string; attrs: Record<string, string> }> = [];
  public completed: string[] = [];
  public listCalls: Array<{ range: SyncRange; limit: number; offset: number }> = [];

  constructor(public blocks: SiYuanTodoBlock[]) {}

  async listTodoBlocks(range: SyncRange, limit: number, offset = 0) {
    this.listCalls.push({ range, limit, offset });
    return this.blocks.slice(offset, offset + limit);
  }

  async setBlockAttrs(blockId: string, attrs: Record<string, string>) {
    this.attrs.push({ blockId, attrs });
  }

  async markBlockCompleted(blockId: string) {
    this.completed.push(blockId);
  }
}

class FakeDida implements DidaGateway {
  public created: Array<{ projectId: string; title: string }> = [];
  public completed: Array<{ projectId: string; taskId: string }> = [];
  public updated: Array<{ projectId: string; taskId: string; title: string }> = [];
  public completedTasks = new Set<string>();
  public completedTaskError: Error | null = null;

  async createTask(projectId: string, title: string) {
    this.created.push({ projectId, title });
    return { id: `task-${this.created.length}`, projectId };
  }

  async updateTaskTitle(projectId: string, taskId: string, title: string) {
    this.updated.push({ projectId, taskId, title });
  }

  async completeTask(projectId: string, taskId: string) {
    this.completed.push({ projectId, taskId });
  }

  async listCompletedTaskIds() {
    if (this.completedTaskError) {
      throw this.completedTaskError;
    }
    return this.completedTasks;
  }
}

describe("SyncEngine", () => {
  test("creates Dida tasks for unsynced incomplete SiYuan todos", async () => {
    const siyuan = new FakeSiYuan([block({})]);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(settings());

    expect(result.created).toBe(1);
    expect(result.scanned).toBe(1);
    expect(result.rangeResults[0]).toMatchObject({ rangeName: "工作", scanned: 1 });
    expect(result.events.some((event) => event.message.includes("创建滴答任务"))).toBe(true);
    expect(dida.created).toEqual([{ projectId: "project-1", title: "整理会议纪要" }]);
    expect(siyuan.attrs[0].attrs["custom-dida-task-id"]).toBe("task-1");
  });

  test("ignores unsynced completed historical todos", async () => {
    const siyuan = new FakeSiYuan([block({ markdown: "- [x] 历史任务" })]);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(settings());

    expect(result.created).toBe(0);
    expect(dida.created).toEqual([]);
  });

  test("completes Dida task when synced SiYuan todo is completed", async () => {
    const siyuan = new FakeSiYuan([
      block({
        markdown: "- [x] 整理会议纪要",
        attrs: {
          "custom-dida-task-id": "task-1",
          "custom-dida-project-id": "project-1",
          "custom-dida-last-hash": "old"
        }
      })
    ]);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(settings());

    expect(result.completed).toBe(1);
    expect(dida.completed).toEqual([{ projectId: "project-1", taskId: "task-1" }]);
    expect(siyuan.attrs[0].attrs["custom-dida-sync-state"]).toBe("completed-synced");
  });

  test("marks SiYuan todo completed when Dida task is completed", async () => {
    const siyuan = new FakeSiYuan([
      block({
        attrs: {
          "custom-dida-task-id": "task-1",
          "custom-dida-project-id": "project-1",
          "custom-dida-last-hash": "old"
        }
      })
    ]);
    const dida = new FakeDida();
    dida.completedTasks.add("task-1");

    const result = await new SyncEngine(siyuan, dida).sync(settings());

    expect(result.writtenBack).toBe(1);
    expect(siyuan.completed).toEqual(["block-1"]);
    expect(siyuan.attrs[0].attrs["custom-dida-sync-state"]).toBe("completed-synced");
  });

  test("continues syncing SiYuan changes when completed task lookup fails", async () => {
    const siyuan = new FakeSiYuan([block({})]);
    const dida = new FakeDida();
    dida.completedTaskError = new Error("fetch failed");

    const result = await new SyncEngine(siyuan, dida).sync(settings());

    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures[0].message).toContain("滴答已完成任务读取失败");
    expect(dida.created).toEqual([{ projectId: "project-1", title: "整理会议纪要" }]);
  });

  test("updates Dida title when a synced SiYuan todo title changes", async () => {
    const siyuan = new FakeSiYuan([
      block({
        markdown: "- [ ] 整理新版会议纪要",
        attrs: {
          "custom-dida-task-id": "task-1",
          "custom-dida-project-id": "project-1",
          "custom-dida-last-hash": taskHash("整理会议纪要", false)
        }
      })
    ]);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(settings());

    expect(result.updated).toBe(1);
    expect(dida.updated).toEqual([{ projectId: "project-1", taskId: "task-1", title: "整理新版会议纪要" }]);
  });

  test("uses range cursor offset and returns the next cursor", async () => {
    const testSettings = settings();
    testSettings.maxTasksPerRun = 2;
    testSettings.ranges[0].cursorOffset = 2;
    const siyuan = new FakeSiYuan([
      block({ id: "block-1", markdown: "- [ ] 任务 1" }),
      block({ id: "block-2", markdown: "- [ ] 任务 2" }),
      block({ id: "block-3", markdown: "- [ ] 任务 3" }),
      block({ id: "block-4", markdown: "- [ ] 任务 4" }),
      block({ id: "block-5", markdown: "- [ ] 任务 5" })
    ]);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(testSettings);

    expect(siyuan.listCalls.map((call) => call.offset)).toEqual([2]);
    expect(dida.created.map((item) => item.title)).toEqual(["任务 3", "任务 4"]);
    expect(result.rangeResults[0]).toMatchObject({ cursorOffset: 2, nextCursorOffset: 4, hasMore: true });
    expect(result.rangeCursorOffsets).toEqual({ "range-1": 4 });
  });

  test("wraps the range cursor to the first page when the offset reaches the end", async () => {
    const testSettings = settings();
    testSettings.maxTasksPerRun = 2;
    testSettings.ranges[0].cursorOffset = 10;
    const siyuan = new FakeSiYuan([
      block({ id: "block-1", markdown: "- [ ] 任务 1" }),
      block({ id: "block-2", markdown: "- [ ] 任务 2" }),
      block({ id: "block-3", markdown: "- [ ] 任务 3" })
    ]);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(testSettings);

    expect(siyuan.listCalls.map((call) => call.offset)).toEqual([10, 0]);
    expect(dida.created.map((item) => item.title)).toEqual(["任务 1", "任务 2"]);
    expect(result.rangeResults[0]).toMatchObject({ cursorOffset: 0, nextCursorOffset: 2, hasMore: true });
    expect(result.rangeCursorOffsets).toEqual({ "range-1": 2 });
  });

  test("checks a recent priority window while rotating through older candidates", async () => {
    const testSettings = settings();
    testSettings.maxTasksPerRun = 20;
    testSettings.ranges[0].cursorOffset = 50;
    const blocks = Array.from({ length: 80 }, (_, index) => block({ id: `block-${index + 1}`, markdown: `- [ ] 任务 ${index + 1}` }));
    const siyuan = new FakeSiYuan(blocks);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(testSettings);

    expect(siyuan.listCalls.map((call) => ({ limit: call.limit, offset: call.offset }))).toEqual([
      { limit: 5, offset: 0 },
      { limit: 15, offset: 50 }
    ]);
    expect(dida.created.map((item) => item.title)).toContain("任务 1");
    expect(dida.created.map((item) => item.title)).toContain("任务 51");
    expect(result.rangeResults[0]).toMatchObject({ cursorOffset: 50, nextCursorOffset: 65, hasMore: true });
  });

  test("archives unchanged legacy completed todos without completing them again", async () => {
    const siyuan = new FakeSiYuan([
      block({
        markdown: "- [x] 整理会议纪要",
        attrs: {
          "custom-dida-task-id": "task-1",
          "custom-dida-project-id": "project-1",
          "custom-dida-last-hash": taskHash("整理会议纪要", true)
        }
      })
    ]);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(settings());

    expect(result.skipped).toBe(1);
    expect(result.completed).toBe(0);
    expect(dida.completed).toEqual([]);
    expect(siyuan.attrs[0].attrs["custom-dida-sync-state"]).toBe("completed-synced");
  });

  test("skips already archived completed todos without writing attrs again", async () => {
    const siyuan = new FakeSiYuan([
      block({
        markdown: "- [x] 整理会议纪要",
        attrs: {
          "custom-dida-task-id": "task-1",
          "custom-dida-project-id": "project-1",
          "custom-dida-last-hash": taskHash("整理会议纪要", true),
          "custom-dida-sync-state": "completed-synced"
        }
      })
    ]);
    const dida = new FakeDida();

    const result = await new SyncEngine(siyuan, dida).sync(settings());

    expect(result.skipped).toBe(1);
    expect(dida.completed).toEqual([]);
    expect(siyuan.attrs).toEqual([]);
  });
});
