import { describe, expect, test } from "vitest";
import { SyncEngine } from "./syncEngine";
import type { DidaGateway, SiYuanGateway, SyncSettings, SiYuanTodoBlock } from "./types";

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

  constructor(public blocks: SiYuanTodoBlock[]) {}

  async listTodoBlocks() {
    return this.blocks;
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
});
