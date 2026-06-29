import { markTodoCompleted } from "../core/todoParser";
import type { SiYuanGateway, SiYuanTodoBlock, SyncRange } from "../core/types";
import { kernelApi } from "./api";

interface SqlBlockRow {
  id: string;
  parent_id?: string;
  markdown: string;
  box: string;
  hpath: string;
}

interface KramdownBlock {
  markdown?: string;
  kramdown?: string;
}

export class SiYuanRepository implements SiYuanGateway {
  async listTodoBlocks(range: SyncRange, limit: number, offset = 0): Promise<SiYuanTodoBlock[]> {
    const sql = buildTodoBlockSql(range, limit, offset);
    const rows = await kernelApi<SqlBlockRow[]>("/api/query/sql", { stmt: sql });
    const blocks = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        parentId: row.parent_id,
        markdown: row.markdown,
        box: row.box,
        hpath: row.hpath,
        attrs: await this.getBlockAttrs(row.id)
      }))
    );
    return blocks;
  }

  async setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    await kernelApi<unknown>("/api/attr/setBlockAttrs", {
      id: blockId,
      attrs
    });
  }

  async markBlockCompleted(blockId: string): Promise<void> {
    const block = await kernelApi<KramdownBlock>("/api/block/getBlockKramdown", { id: blockId });
    const markdown = block.kramdown ?? block.markdown;
    if (!markdown) {
      throw new Error("SiYuan getBlockKramdown returned no kramdown content");
    }
    const completedMarkdown = markTodoCompleted(markdown);
    if (completedMarkdown === markdown) {
      throw new Error("Unable to mark SiYuan todo completed: unsupported task markdown");
    }
    await kernelApi<unknown>("/api/block/updateBlock", {
      id: blockId,
      dataType: "markdown",
      data: completedMarkdown
    });
  }

  async getBlockAttrs(blockId: string): Promise<Record<string, string>> {
    return kernelApi<Record<string, string>>("/api/attr/getBlockAttrs", { id: blockId });
  }
}

export function buildTodoBlockSql(range: SyncRange, limit: number, offset = 0): string {
  const hpathClause = range.includeChildren
    ? `hpath LIKE '${escapeSqlLike(range.hpathPrefix)}%'`
    : `hpath = '${escapeSql(range.hpathPrefix)}'`;
  const incompleteClause = `(
        markdown LIKE '- [ ] %'
        OR markdown LIKE '* [ ] %'
        OR markdown LIKE '- {: %}[ ] %'
        OR markdown LIKE '* {: %}[ ] %'
      )`;
  const completedClause = `(
        markdown LIKE '- [x] %'
        OR markdown LIKE '* [x] %'
        OR markdown LIKE '- [X] %'
        OR markdown LIKE '* [X] %'
        OR markdown LIKE '- {: %}[x] %'
        OR markdown LIKE '* {: %}[x] %'
        OR markdown LIKE '- {: %}[X] %'
        OR markdown LIKE '* {: %}[X] %'
      )`;
  const archivedCompletedClause = `ial NOT LIKE '%custom-dida-sync-state="completed-synced"%'`;

  return `
    SELECT id, parent_id, markdown, box, hpath
    FROM blocks
    WHERE box = '${escapeSql(range.notebookId)}'
      AND ${hpathClause}
      AND type = 'i'
      AND subtype = 't'
      AND (
        ${incompleteClause}
        OR (${completedClause} AND ial LIKE '%custom-dida-task-id%' AND ${archivedCompletedClause})
      )
    ORDER BY
      CASE
        WHEN markdown LIKE '- [ ] %'
          OR markdown LIKE '* [ ] %'
          OR markdown LIKE '- {: %}[ ] %'
          OR markdown LIKE '* {: %}[ ] %'
        THEN 0
        ELSE 1
      END,
      updated DESC
    LIMIT ${Math.max(1, limit)} OFFSET ${Math.max(0, offset)}
  `;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeSqlLike(value: string): string {
  return escapeSql(value).replace(/%/g, "\\%").replace(/_/g, "\\_");
}
