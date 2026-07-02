export interface SyncRange {
  id: string;
  name: string;
  notebookId: string;
  hpathPrefix: string;
  includeChildren: boolean;
  targetProjectId: string;
  targetProjectName: string;
  cursorOffset?: number;
}

export interface SyncSettings {
  maxTasksPerRun: number;
  ranges: SyncRange[];
}

export interface SiYuanTodoBlock {
  id: string;
  parentId?: string;
  markdown: string;
  box: string;
  hpath: string;
  attrs: Record<string, string>;
}

export interface SyncResult {
  created: number;
  updated: number;
  completed: number;
  writtenBack: number;
  failed: number;
  skipped: number;
  scanned: number;
  rangeResults: SyncRangeResult[];
  rangeCursorOffsets: Record<string, number>;
  events: SyncEvent[];
  failures: Array<{ blockId?: string; message: string }>;
  startedAt: string;
  finishedAt: string;
}

export interface SyncRangeResult {
  rangeId: string;
  rangeName: string;
  notebookId: string;
  hpathPrefix: string;
  scanned: number;
  created: number;
  updated: number;
  completed: number;
  writtenBack: number;
  failed: number;
  skipped: number;
  cursorOffset: number;
  nextCursorOffset: number;
  hasMore: boolean;
}

export interface SyncEvent {
  time: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  blockId?: string;
  rangeId?: string;
}

export interface SiYuanGateway {
  listTodoBlocks(range: SyncRange, limit: number, offset?: number): Promise<SiYuanTodoBlock[]>;
  getBlockAttrs(blockId: string): Promise<Record<string, string>>;
  setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void>;
  markBlockCompleted(blockId: string): Promise<void>;
}

export interface DidaGateway {
  createTask(projectId: string, title: string, content?: string): Promise<{ id: string; projectId: string }>;
  updateTaskTitle(projectId: string, taskId: string, title: string): Promise<void>;
  setTaskParent(projectId: string, taskId: string, parentTaskId: string): Promise<void>;
  completeTask(projectId: string, taskId: string): Promise<void>;
  listCompletedTaskIds(projectIds: string[]): Promise<Set<string>>;
}
