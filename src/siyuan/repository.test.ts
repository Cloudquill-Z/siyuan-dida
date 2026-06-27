import { describe, expect, test } from "vitest";
import { buildTodoBlockSql } from "./repository";

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
      200
    );

    expect(sql).toContain("subtype = 't'");
    expect(sql).toContain("ial LIKE '%custom-dida-task-id%'");
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("CASE WHEN markdown LIKE '- [ ] %'");
  });
});
