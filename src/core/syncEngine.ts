import { localAllDayStart } from "./date";
import { taskHash } from "./hash";
import { parseTodoMarkdown } from "./todoParser";
import type { DidaGateway, SiYuanGateway, SyncEvent, SyncRange, SyncRangeResult, SyncResult, SyncSettings, SiYuanTodoBlock } from "./types";

const TASK_ID_ATTR = "custom-dida-task-id";
const PROJECT_ID_ATTR = "custom-dida-project-id";
const LAST_SYNC_ATTR = "custom-dida-last-sync";
const LAST_HASH_ATTR = "custom-dida-last-hash";
const SYNC_STATE_ATTR = "custom-dida-sync-state";
const SYNC_STATE_SYNCED = "synced";
const SYNC_STATE_COMPLETED_SYNCED = "completed-synced";
const DIDA_TASK_SOURCE_CONTENT = "来源：思源笔记";

interface TaskBinding {
  taskId: string;
  projectId: string;
}

interface RangeSyncContext {
  blocksById: Map<string, SiYuanTodoBlock>;
  knownBindings: Map<string, TaskBinding>;
}

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
    rangeCursorOffsets: {},
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

function bindingFromAttrs(attrs: Record<string, string>): TaskBinding | null {
  const taskId = attrs[TASK_ID_ATTR];
  const projectId = attrs[PROJECT_ID_ATTR];
  if (!taskId || !projectId) {
    return null;
  }
  return { taskId, projectId };
}

function binding(block: SiYuanTodoBlock): TaskBinding | null {
  return bindingFromAttrs(block.attrs);
}

function attrsFor(taskId: string, projectId: string, hash: string, syncState = SYNC_STATE_SYNCED): Record<string, string> {
  return {
    [TASK_ID_ATTR]: taskId,
    [PROJECT_ID_ATTR]: projectId,
    [LAST_SYNC_ATTR]: new Date().toISOString(),
    [LAST_HASH_ATTR]: hash,
    [SYNC_STATE_ATTR]: syncState
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
      let cursorOffset = normalizeOffset(range.cursorOffset);
      const page = await this.listRangePage(range, settings.maxTasksPerRun, cursorOffset);
      let blocks = page.blocks;
      let rotatingCount = page.rotatingCount;
      let rotatingLimit = page.rotatingLimit;
      if (rotatingCount === 0 && cursorOffset > 0) {
        addEvent(result, "debug", `范围「${range.name}」游标已到末尾，回到开头继续扫描`, { rangeId: range.id });
        cursorOffset = 0;
        blocks = await this.siyuan.listTodoBlocks(range, settings.maxTasksPerRun, cursorOffset);
        rotatingCount = blocks.length;
        rotatingLimit = settings.maxTasksPerRun;
      }
      const hasMore = rotatingCount >= rotatingLimit;
      const nextCursorOffset = hasMore ? cursorOffset + rotatingCount : 0;
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
        skipped: 0,
        cursorOffset,
        nextCursorOffset,
        hasMore
      };
      result.rangeCursorOffsets[range.id] = nextCursorOffset;
      result.scanned += blocks.length;
      result.rangeResults.push(rangeResult);
      addEvent(result, "info", `范围「${range.name}」扫描到 ${blocks.length} 个候选任务`, { rangeId: range.id });
      const orderedBlocks = orderBlocksForParentSync(blocks);
      const context: RangeSyncContext = {
        blocksById: new Map(blocks.map((block) => [block.id, block])),
        knownBindings: new Map(
          blocks
            .map((block) => [block.id, binding(block)] as const)
            .filter((item): item is readonly [string, TaskBinding] => item[1] !== null)
        )
      };
      for (const block of orderedBlocks) {
        await this.syncBlock(block, range.targetProjectId, completedTaskIds, result, rangeResult, context);
      }
      addEvent(
        result,
        "debug",
        hasMore ? `范围「${range.name}」下一轮从第 ${nextCursorOffset + 1} 个候选任务继续` : `范围「${range.name}」已扫到末尾，下轮从开头继续`,
        { rangeId: range.id }
      );
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
    rangeResult: SyncRangeResult,
    context: RangeSyncContext
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
        const parent = await this.resolveParentBinding(block, context);
        if (parent.hasParent && !parent.binding) {
          result.skipped += 1;
          rangeResult.skipped += 1;
          addEvent(result, "debug", `跳过未绑定父任务下的新子任务：${parsed.title}`, {
            blockId: block.id,
            rangeId: rangeResult.rangeId
          });
          return;
        }
        const created = await this.dida.createTask(targetProjectId, parsed.title, {
          content: DIDA_TASK_SOURCE_CONTENT,
          allDay: true,
          startDate: localAllDayStart()
        });
        if (parent.binding) {
          await this.dida.setTaskParent(created.projectId, created.id, parent.binding.taskId);
        }
        await this.siyuan.setBlockAttrs(block.id, attrsFor(created.id, created.projectId, currentHash));
        context.knownBindings.set(block.id, { taskId: created.id, projectId: created.projectId });
        result.created += 1;
        rangeResult.created += 1;
        addEvent(result, "info", `创建滴答任务：${parsed.title}`, { blockId: block.id, rangeId: rangeResult.rangeId });
        return;
      }

      if (!parsed.checked && completedTaskIds.has(existing.taskId)) {
        await this.siyuan.markBlockCompleted(block.id);
        await this.siyuan.setBlockAttrs(block.id, attrsFor(existing.taskId, existing.projectId, taskHash(parsed.title, true), SYNC_STATE_COMPLETED_SYNCED));
        result.writtenBack += 1;
        rangeResult.writtenBack += 1;
        addEvent(result, "info", `滴答完成回写思源：${parsed.title}`, { blockId: block.id, rangeId: rangeResult.rangeId });
        return;
      }

      if (block.attrs[LAST_HASH_ATTR] === currentHash) {
        if (parsed.checked && block.attrs[SYNC_STATE_ATTR] !== SYNC_STATE_COMPLETED_SYNCED) {
          await this.siyuan.setBlockAttrs(block.id, attrsFor(existing.taskId, existing.projectId, currentHash, SYNC_STATE_COMPLETED_SYNCED));
          addEvent(result, "debug", `归档已完成同步任务：${parsed.title}`, {
            blockId: block.id,
            rangeId: rangeResult.rangeId
          });
        }
        result.skipped += 1;
        rangeResult.skipped += 1;
        addEvent(result, "debug", `跳过未变化的已绑定任务：${parsed.title}`, {
          blockId: block.id,
          rangeId: rangeResult.rangeId
        });
        return;
      }

      if (parsed.checked) {
        await this.dida.completeTask(existing.projectId, existing.taskId);
        await this.siyuan.setBlockAttrs(block.id, attrsFor(existing.taskId, existing.projectId, currentHash, SYNC_STATE_COMPLETED_SYNCED));
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

  private async listRangePage(range: SyncRange, limit: number, cursorOffset: number) {
    if (cursorOffset <= 0 || limit < 20) {
      const blocks = await this.siyuan.listTodoBlocks(range, limit, cursorOffset);
      return { blocks, rotatingCount: blocks.length, rotatingLimit: limit };
    }

    const priorityLimit = Math.max(1, Math.floor(limit / 4));
    const rotatingLimit = limit - priorityLimit;
    const priorityBlocks = await this.siyuan.listTodoBlocks(range, priorityLimit, 0);
    const rotatingBlocks = await this.siyuan.listTodoBlocks(range, rotatingLimit, cursorOffset);
    return {
      blocks: uniqueBlocks([...priorityBlocks, ...rotatingBlocks]),
      rotatingCount: rotatingBlocks.length,
      rotatingLimit
    };
  }

  private async resolveParentBinding(block: SiYuanTodoBlock, context: RangeSyncContext): Promise<{ hasParent: boolean; binding?: TaskBinding }> {
    if (!block.parentId) {
      return { hasParent: false };
    }

    const known = context.knownBindings.get(block.parentId);
    if (known) {
      return { hasParent: true, binding: known };
    }

    const parentBlock = context.blocksById.get(block.parentId);
    if (parentBlock) {
      const parentBinding = binding(parentBlock);
      if (parentBinding) {
        context.knownBindings.set(block.parentId, parentBinding);
        return { hasParent: true, binding: parentBinding };
      }
      return { hasParent: true };
    }

    try {
      const parentAttrs = await this.siyuan.getBlockAttrs(block.parentId);
      const parentBinding = bindingFromAttrs(parentAttrs);
      if (parentBinding) {
        context.knownBindings.set(block.parentId, parentBinding);
        return { hasParent: true, binding: parentBinding };
      }
    } catch {
      // Keep the child unsynced rather than creating it as a top-level task.
    }

    return { hasParent: true };
  }
}

function normalizeOffset(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function uniqueBlocks(blocks: SiYuanTodoBlock[]): SiYuanTodoBlock[] {
  const seen = new Set<string>();
  return blocks.filter((block) => {
    if (seen.has(block.id)) {
      return false;
    }
    seen.add(block.id);
    return true;
  });
}

function orderBlocksForParentSync(blocks: SiYuanTodoBlock[]): SiYuanTodoBlock[] {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const emitted = new Set<string>();
  const ordered: SiYuanTodoBlock[] = [];

  const emit = (block: SiYuanTodoBlock) => {
    if (emitted.has(block.id)) {
      return;
    }
    if (block.parentId) {
      const parent = byId.get(block.parentId);
      if (parent) {
        emit(parent);
      }
    }
    emitted.add(block.id);
    ordered.push(block);
  };

  for (const block of blocks) {
    emit(block);
  }

  return ordered;
}
