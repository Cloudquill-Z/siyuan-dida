import type { SyncRange } from "../core/types";

export function createEmptyRange(index: number): SyncRange {
  return {
    id: `range-${index}`,
    name: `同步范围 ${index}`,
    notebookId: "",
    hpathPrefix: "",
    includeChildren: true,
    targetProjectId: "",
    targetProjectName: ""
  };
}

export function prepareRangesForSave(ranges: SyncRange[]): SyncRange[] {
  return ranges
    .map((range, index) => normalizeRange(range, index + 1))
    .filter((range) => !isEmptyRange(range))
    .map((range, index) => validateRange(range, index + 1));
}

function normalizeRange(range: SyncRange, index: number): SyncRange {
  return {
    id: range.id.trim() || `range-${index}`,
    name: range.name.trim() || `同步范围 ${index}`,
    notebookId: range.notebookId.trim(),
    hpathPrefix: range.hpathPrefix.trim(),
    includeChildren: range.includeChildren,
    targetProjectId: range.targetProjectId.trim(),
    targetProjectName: range.targetProjectName.trim()
  };
}

function isEmptyRange(range: SyncRange): boolean {
  return !range.notebookId && !range.hpathPrefix && !range.targetProjectId && !range.targetProjectName;
}

function validateRange(range: SyncRange, index: number): SyncRange {
  if (!range.notebookId) {
    throw new Error(`同步范围 ${index} 缺少笔记本`);
  }
  if (!range.hpathPrefix) {
    throw new Error(`同步范围 ${index} 缺少文档路径`);
  }
  if (!range.targetProjectId) {
    throw new Error(`同步范围 ${index} 缺少滴答清单`);
  }
  return range;
}
