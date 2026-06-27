import type { SyncRange, SyncResult } from "../core/types";

export interface PluginSettings {
  cliCommand: string;
  resolvedCliPath: string;
  autoSync: boolean;
  syncIntervalSeconds: number;
  syncOnStartup: boolean;
  maxTasksPerRun: number;
  useProxy: boolean;
  proxyUrl: string;
  ranges: SyncRange[];
  logs: SyncResult[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
  cliCommand: "dida",
  resolvedCliPath: "",
  autoSync: false,
  syncIntervalSeconds: 15,
  syncOnStartup: false,
  maxTasksPerRun: 200,
  useProxy: true,
  proxyUrl: "http://127.0.0.1:7890",
  ranges: [],
  logs: []
};

export function normalizeSettings(value: Partial<PluginSettings> | null | undefined): PluginSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    ranges: value?.ranges ?? [],
    logs: value?.logs ?? []
  };
}
