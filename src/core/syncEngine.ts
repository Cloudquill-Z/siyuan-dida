import { taskHash } from "./hash";
import { parseTodoMarkdown } from "./todoParser";
import type { DidaGateway, SiYuanGateway, SyncEvent, SyncRangeResult, SyncResult, SyncSettings, SiYuanTodoBlock } from "./types";

const TASK_ID_ATTR = "custom-dida-task-id";
const PROJECT_ID_ATTR = "custom-dida-project-id";
const LAST_SYNC_ATTR = "custom-dida-last-sync";
const LAST_HASH_ATTR = "custom-dida-last-hash";
const SYNC_STATE_ATTR = "custom-dida-sync-state";

function emptyResult(): SyncResult {
  const now = new Date().toISOString();
  return {
    created: 0,
    updated: 0,
    completed: 0,
    writtenBack: 0,
    failed: 0,
    skipped: 0,
    scanned: 0,
    rangeResults: [],
    events: [],
    failures: [],
    startedAt: now,
    finishedAt: now
  };
}

function addEvent(
  result: SyncResult,
  level: SyncEvent["level"],
  message: string,
  extra: Pick<SyncEvent, "blockId" | "rangeId"> = {}
) {
  result.events.push({
    time: new Date().toISOString(),
    level,
    message,
    ...extra
  });
}

function binding(block: SiYuanTodoBlock) {
  const taskId = block.attrs[TASK_ID_ATTR];
  const projectId = block.attrs[PROJECT_ID_ATTR];
  if (!taskId || !projectId) {
    return null;
  }
  return { taskId, projectId };
}

function attrsFor(taskId: string, projectId: string, hash: string): Record<string, string> {
  return {
    [TASK_ID_ATTR]: taskId,
    [PROJECT_ID_ATTR]: projectId,
    [LAST_SYNC_ATTR]: new Date().toISOString(),
    [LAST_HASH_ATTR]: hash,
    [SYNC_STATE_ATTR]: "synced"
  };
}

export class SyncEngine {
  constructor(
    private readonly siyuan: SiYuanGateway,
    private readonly dida: DidaGateway
  ) {}

  async sync(settings: SyncSettings): Promise<SyncResult> {
    const result = emptyResult();
    const projectIds = settings.ranges.map((range) => range.targetProjectId).filter(Boolean);
    addEvent(result, "info", `开始同步：范围 ${settings.ranges.length} 个，最大处理 ${settings.maxTasksPerRun} 个`);
    let completedTaskIds = new Set<string>();
    try {
      completedTaskIds = await this.dida.listCompletedTaskIds(projectIds);
      addEvent(result, "debug", `读取滴答已完成任务 ${completedTaskIds.size} 个`);
    } catch (error) {
      result.failed += 1;
      result.failures.push({
        message: `滴答已完成任务读取失败，已跳过滴答到思源回写：${(error as Error).message}`
      });
      addEvent(result, "warn", `滴答已完成任务读取失败，已跳过回写：${(error as Error).message}`);
    }

    for (const range of settings.ranges) {
      const blocks = await this.siyuan.listTodoBlocks(range, settings.maxTasksPerRun);
      const rangeResult: SyncRangeResult = {
        rangeId: range.id,
        rangeName: range.name,
        notebookId: range.notebookId,
        hpathPrefix: range.hpathPrefix,
        scanned: blocks.length,
        created: 0,
        updated: 0,
        completed: 0,
        writtenBack: 0,
        failed: 0,
        skipped: 0
      };
      result.scanned += blocks.length;
      result.rangeResults.push(rangeResult);
      addEvent(result, "info", `范围「${range.name}」扫描到 ${blocks.length} 个候选任务`, { rangeId: range.id });
      for (const block of blocks) {
        await this.syncBlock(block, range.targetProjectId, completedTaskIds, result, rangeResult);
      }
    }

    result.finishedAt = new Date().toISOString();
    addEvent(
      result,
      result.failed > 0 ? "warn" : "info",
      `同步结束：扫描 ${result.scanned}，新增 ${result.created}，更新 ${result.updated}，完成 ${result.completed}，回写 ${result.writtenBack}，失败 ${result.failed}`
    );
    return result;
  }

  private async syncBlock(
    block: SiYuanTodoBlock,
    targetProjectId: string,
    completedTaskIds: Set<string>,
    result: SyncResult,
    rangeResult: SyncRangeResult
  ) {
    try {
      const parsed = parseTodoMarkdown(block.markdown);
      if (!parsed) {
        result.skipped += 1;
        rangeResult.skipped += 1;
        addEvent(result, "debug", "跳过非待办块", { blockId: block.id, rangeId: rangeResult.rangeId });
        return;
      }

      const currentHash = taskHash(parsed.title, parsed.checked);
      const existing = binding(block);

      if (!existing) {
        if (parsed.checked) {
          result.skipped += 1;
          rangeResult.skipped += 1;
          addEvent(result, "debug", `跳过未绑定的历史已完成任务：${parsed.title}`, {
            blockId: block.id,
            rangeId: rangeResult.rangeId
          });
          return;
        }
        const created = await this.dida.createTask(targetProjectId, parsed.title);
        await this.siyuan.setBlockAttrs(block.id, attrsFor(created.id, created.projectId, currentHash));
        result.created += 1;
        rangeResult.created += 1;
        addEvent(result, "info", `创建滴答任务：${parsed.title}`, { blockId: block.id, rangeId: rangeResult.rangeId });
        return;
      }

      if (!parsed.checked && completedTaskIds.has(existing.taskId)) {
        await this.siyuan.markBlockCompleted(block.id);
        await this.siyuan.setBlockAttrs(block.id, attrsFor(existing.taskId, existing.projectId, taskHash(parsed.title, true)));
        result.writtenBack += 1;
        rangeResult.writtenBack += 1;
        addEvent(result, "info", `滴答完成回写思源：${parsed.title}`, { blockId: block.id, rangeId: rangeResult.rangeId });
        return;
      }

      if (parsed.checked) {
        await this.dida.completeTask(existing.projectId, existing.taskId);
        await this.siyuan.setBlockAttrs(block.id, attrsFor(existing.taskId, existing.projectId, currentHash));
        result.completed += 1;
        rangeResult.completed += 1;
        addEvent(result, "info", `思源完成同步到滴答：${parsed.title}`, { blockId: block.id, rangeId: rangeResult.rangeId });
        return;
      }

      if (block.attrs[LAST_HASH_ATTR] !== currentHash) {
        await this.dida.updateTaskTitle(existing.projectId, existing.taskId, parsed.title);
        await this.siyuan.setBlockAttrs(block.id, attrsFor(existing.taskId, existing.projectId, currentHash));
        result.updated += 1;
        rangeResult.updated += 1;
        addEvent(result, "info", `更新滴答任务标题：${parsed.title}`, { blockId: block.id, rangeId: rangeResult.rangeId });
      }
    } catch (error) {
      result.failed += 1;
      rangeResult.failed += 1;
      result.failures.push({ blockId: block.id, message: (error as Error).message });
      addEvent(result, "error", (error as Error).message, { blockId: block.id, rangeId: rangeResult.rangeId });
    }
  }
}
