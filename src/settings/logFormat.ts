import type { SyncResult } from "../core/types";

export function formatSyncLogs(logs: SyncResult[]): string {
  if (logs.length === 0) {
    return "暂无同步日志。";
  }

  return logs
    .map((log, index) => {
      const lines = [
        `#${index + 1} ${log.finishedAt || log.startedAt}`,
        `汇总：扫描 ${log.scanned ?? "?"}，新增 ${log.created}，更新 ${log.updated}，完成 ${log.completed}，回写 ${log.writtenBack}，跳过 ${log.skipped}，失败 ${log.failed}`
      ];

      for (const range of log.rangeResults ?? []) {
        lines.push(
          `范围 ${range.rangeName} (${range.hpathPrefix})：扫描 ${range.scanned}，新增 ${range.created}，更新 ${range.updated}，完成 ${range.completed}，回写 ${range.writtenBack}，跳过 ${range.skipped}，失败 ${range.failed}`
        );
      }

      for (const failure of log.failures ?? []) {
        lines.push(`失败：${failure.blockId ? `${failure.blockId} ` : ""}${failure.message}`);
      }

      for (const event of (log.events ?? []).slice(-30)) {
        lines.push(`[${event.level}] ${event.time} ${event.blockId ? `${event.blockId} ` : ""}${event.message}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

export function summarizeSyncLog(log: SyncResult): string {
  return `扫描 ${log.scanned ?? "?"}，新增 ${log.created}，更新 ${log.updated}，完成 ${log.completed}，回写 ${log.writtenBack}，失败 ${log.failed}`;
}
