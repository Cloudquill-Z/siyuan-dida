import { hostname } from "node:os";
import type { PluginSettings } from "./defaults";

export function getCliDeviceKey(platform = process.platform, host = hostname()): string {
  return `${platform}:${host || "unknown"}`;
}

export function getResolvedCliPathForCurrentDevice(settings: PluginSettings, deviceKey = getCliDeviceKey()): string {
  return settings.resolvedCliPaths[deviceKey] || "";
}

export function withResolvedCliPathForCurrentDevice(
  settings: PluginSettings,
  resolvedCliPath: string,
  deviceKey = getCliDeviceKey()
): PluginSettings {
  return {
    ...settings,
    resolvedCliPath,
    resolvedCliPaths: {
      ...settings.resolvedCliPaths,
      [deviceKey]: resolvedCliPath
    }
  };
}
