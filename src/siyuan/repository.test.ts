import { afterEach, describe, expect, test, vi } from "vitest";
import { SiYuanRepository, buildTodoBlockSql } from "./repository";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildTodoBlockSql", () => {
  test("prioritizes incomplete todos and excludes unbound completed history", () => {
    const sql = buildTodoBlockSql(
      {
        id: "range-1",
        name: "工作日志",
        notebookId: "box-1",
        hpathPrefix: "/log-工作日志",
        includeChildren: true,
        targetProjectId: "project-1",
        targetProjectName: "工作"
      },
      200,
      400
    );

    expect(sql).toContain("subtype = 't'");
    expect(sql).toContain("ial LIKE '%custom-dida-task-id%'");
    expect(sql).toContain("ial NOT LIKE '%custom-dida-sync-state=\"completed-synced\"%'");
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("CASE WHEN markdown LIKE '- [ ] %'");
    expect(sql).toContain("LIMIT 200 OFFSET 400");
  });
});

describe("SiYuanRepository", () => {
  test("marks a block completed when getBlockKramdown returns kramdown", async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (path, init) => {
      calls.push({
        path: String(path),
        body: JSON.parse(String(init?.body))
      });
      const data = calls.length === 1 ? { kramdown: "- [ ] 完成测试" } : null;
      return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
    });

    await new SiYuanRepository().markBlockCompleted("20260623224013-tx3inum");

    expect(calls).toEqual([
      {
        path: "/api/block/getBlockKramdown",
        body: { id: "20260623224013-tx3inum" }
      },
      {
        path: "/api/block/updateBlock",
        body: {
          id: "20260623224013-tx3inum",
          dataType: "markdown",
          data: "- [x] 完成测试"
        }
      }
    ]);
  });

  test("marks SiYuan kramdown list tasks with inline attrs completed", async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (path, init) => {
      calls.push({
        path: String(path),
        body: JSON.parse(String(init?.body))
      });
      const data =
        calls.length === 1
          ? { kramdown: '- {: custom-status="todo" id="20260623224013-tx3inum"}[ ] 思源笔记插件\n  {: id="child"}' }
          : null;
      return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
    });

    await new SiYuanRepository().markBlockCompleted("20260623224013-tx3inum");

    expect(calls[1]).toEqual({
      path: "/api/block/updateBlock",
      body: {
        id: "20260623224013-tx3inum",
        dataType: "markdown",
        data: '- {: custom-status="todo" id="20260623224013-tx3inum"}[x] 思源笔记插件\n  {: id="child"}'
      }
    });
  });

  test("fails completion when kramdown cannot be rewritten", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ code: 0, data: { kramdown: "普通段落" } }), { status: 200 });
    });

    await expect(new SiYuanRepository().markBlockCompleted("20260623224013-tx3inum")).rejects.toThrow("Unable to mark SiYuan todo completed");
  });
});
