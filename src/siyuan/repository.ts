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
    const rows = (await kernelApi<SqlBlockRow[] | null>("/api/query/sql", { stmt: sql })) ?? [];
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
    ? `(b.hpath = '${escapeSql(range.hpathPrefix)}' OR b.hpath LIKE '${escapeSqlLike(range.hpathPrefix)}/%' ESCAPE '\\')`
    : `b.hpath = '${escapeSql(range.hpathPrefix)}'`;
  const incompleteClause = `(
        b.markdown LIKE '- [ ] %'
        OR b.markdown LIKE '* [ ] %'
        OR b.markdown LIKE '- {: %}[ ] %'
        OR b.markdown LIKE '* {: %}[ ] %'
      )`;
  const completedClause = `(
        b.markdown LIKE '- [x] %'
        OR b.markdown LIKE '* [x] %'
        OR b.markdown LIKE '- [X] %'
        OR b.markdown LIKE '* [X] %'
        OR b.markdown LIKE '- {: %}[x] %'
        OR b.markdown LIKE '* {: %}[x] %'
        OR b.markdown LIKE '- {: %}[X] %'
        OR b.markdown LIKE '* {: %}[X] %'
      )`;
  const archivedCompletedClause = `b.ial NOT LIKE '%custom-dida-sync-state="completed-synced"%'`;

  return `
    SELECT
      b.id,
      CASE
        WHEN parent.type = 'i' AND parent.subtype = 't' THEN parent.id
        WHEN parent.type = 'l' AND grandparent.type = 'i' AND grandparent.subtype = 't' THEN grandparent.id
        ELSE NULL
      END AS parent_id,
      b.markdown,
      b.box,
      b.hpath
    FROM blocks b
    LEFT JOIN blocks parent ON parent.id = b.parent_id
    LEFT JOIN blocks grandparent ON grandparent.id = parent.parent_id
    WHERE b.box = '${escapeSql(range.notebookId)}'
      AND ${hpathClause}
      AND b.type = 'i'
      AND b.subtype = 't'
      AND (
        ${incompleteClause}
        OR (${completedClause} AND b.ial LIKE '%custom-dida-task-id%' AND ${archivedCompletedClause})
      )
    ORDER BY
      CASE
        WHEN b.markdown LIKE '- [ ] %'
          OR b.markdown LIKE '* [ ] %'
          OR b.markdown LIKE '- {: %}[ ] %'
          OR b.markdown LIKE '* {: %}[ ] %'
        THEN 0
        ELSE 1
      END,
      b.updated DESC
    LIMIT ${Math.max(1, limit)} OFFSET ${Math.max(0, offset)}
  `;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeSqlLike(value: string): string {
  return escapeSql(value).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
