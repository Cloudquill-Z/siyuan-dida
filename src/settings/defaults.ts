import type { NewTaskDate, SyncRange, SyncResult } from "../core/types";

export interface PluginSettings {
  cliCommand: string;
  resolvedCliPath: string;
  resolvedCliPaths: Record<string, string>;
  autoSync: boolean;
  newTaskDate: NewTaskDate;
  syncIntervalSeconds: number;
  syncOnStartup: boolean;
  maxTasksPerRun: number;
  ranges: SyncRange[];
  logs: SyncResult[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
  cliCommand: "dida",
  resolvedCliPath: "",
  resolvedCliPaths: {},
  autoSync: false,
  newTaskDate: "today",
  syncIntervalSeconds: 15,
  syncOnStartup: false,
  maxTasksPerRun: 200,
  ranges: [],
  logs: []
};

export function normalizeSettings(value: Partial<PluginSettings> | null | undefined): PluginSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    newTaskDate: value?.newTaskDate === "none" ? "none" : "today",
    resolvedCliPaths: value?.resolvedCliPaths ?? {},
    ranges: value?.ranges ?? [],
    logs: value?.logs ?? []
  };
}

export function settingsForSave(current: PluginSettings, updates: Partial<PluginSettings>): PluginSettings {
  const next = normalizeSettings({
    ...current,
    ...updates
  });
  if (next.cliCommand !== current.cliCommand) {
    next.resolvedCliPath = "";
    next.resolvedCliPaths = {};
  }
  return next;
}
