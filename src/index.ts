import "./index.scss";
import { Dialog, Plugin, showMessage } from "siyuan";
import { SyncEngine } from "./core/syncEngine";
import { resolveDidaCommand, DidaCliClient } from "./dida/cli";
import { DidaCliGateway } from "./dida/gateway";
import { DEFAULT_SETTINGS, normalizeSettings, type PluginSettings } from "./settings/defaults";
import { getResolvedCliPathForCurrentDevice, withResolvedCliPathForCurrentDevice } from "./settings/deviceCli";
import { summarizeSyncLog } from "./settings/logFormat";
import { buildSettingsPanel } from "./settings/settingsPanel";
import { SiYuanRepository } from "./siyuan/repository";
import { setSyncTooltip } from "./syncTooltip";
import type { SyncResult } from "./core/types";

const STORAGE_NAME = "settings.json";

export default class SiyuanDidaPlugin extends Plugin {
  private settings!: PluginSettings;
  private syncTimer: number | undefined;
  private syncRunning = false;
  private syncButton!: HTMLElement;

  async onload() {
    this.settings = normalizeSettings(await this.loadData(STORAGE_NAME));
    this.syncButton = this.addTopBar({
      icon: "iconRefresh",
      title: "同步滴答清单",
      position: "right",
      callback: () => void this.runSync()
    });
    this.updateStatus("滴答：待同步");

    this.addCommand({
      langKey: "sync-dida-now",
      hotkey: "",
      callback: () => void this.runSync()
    });

    this.resetTimer();
    if (this.settings.syncOnStartup) {
      setTimeout(() => void this.runSync(), 1000);
    }
  }

  onunload() {
    if (this.syncTimer !== undefined) {
      window.clearInterval(this.syncTimer);
    }
  }

  openSetting() {
    const mountId = `dida-sync-settings-${Date.now()}`;
    new Dialog({
      title: "滴答同步设置",
      content: `<div id="${mountId}"></div>`,
      width: "760px"
    });

    setTimeout(() => {
      const mount = document.getElementById(mountId);
      if (!mount) {
        return;
      }
      mount.appendChild(
        buildSettingsPanel({
          settings: this.settings,
          onSave: async (settings) => {
            this.settings = normalizeSettings(settings);
            await this.saveSettings();
            this.resetTimer();
          }
        })
      );
    }, 0);
  }

  private async saveSettings() {
    await this.saveData(STORAGE_NAME, this.settings);
  }

  private resetTimer() {
    if (this.syncTimer !== undefined) {
      window.clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }

    if (!this.settings.autoSync) {
      return;
    }

    const intervalMs = Math.max(5, this.settings.syncIntervalSeconds) * 1000;
    this.syncTimer = window.setInterval(() => void this.runSync({ silentSkip: true }), intervalMs);
  }

  private async runSync(options: { silentSkip?: boolean } = {}) {
    if (this.syncRunning) {
      if (!options.silentSkip) {
        showMessage("滴答同步正在执行，已跳过本次触发");
      }
      return;
    }

    if (this.settings.ranges.length === 0) {
      showMessage("请先在插件设置中配置同步范围", 5000, "info");
      return;
    }

    this.syncRunning = true;
    try {
      const resolved = await resolveDidaCommand(getResolvedCliPathForCurrentDevice(this.settings) || this.settings.cliCommand || "dida");
      this.settings = withResolvedCliPathForCurrentDevice(this.settings, resolved.command);
      const didaGateway = new DidaCliGateway(new DidaCliClient(resolved.command));
      const engine = new SyncEngine(new SiYuanRepository(), didaGateway);
      const result = await engine.sync({
        maxTasksPerRun: this.settings.maxTasksPerRun || DEFAULT_SETTINGS.maxTasksPerRun,
        ranges: this.settings.ranges
      });
      this.settings.ranges = this.settings.ranges.map((range) => ({
        ...range,
        cursorOffset: result.rangeCursorOffsets[range.id] ?? range.cursorOffset ?? 0
      }));
      this.settings.logs = [result, ...this.settings.logs].slice(0, 20);
      await this.saveSettings();
      this.updateStatus(`滴答：${new Date().toLocaleTimeString()} ${result.failed > 0 ? "有失败" : "已同步"}`);
      if (!options.silentSkip) {
        showMessage(`滴答同步完成：${summarizeSyncLog(result)}`);
      }
    } catch (error) {
      const result = createErrorSyncResult((error as Error).message);
      this.settings.logs = [result, ...this.settings.logs].slice(0, 20);
      await this.saveSettings();
      this.updateStatus(`滴答：${new Date().toLocaleTimeString()} 同步失败`);
      if (!options.silentSkip) {
        showMessage(`滴答同步失败：${(error as Error).message}`, 7000, "error");
      }
    } finally {
      this.syncRunning = false;
    }
  }

  private updateStatus(text: string) {
    if (this.syncButton) {
      setSyncTooltip(this.syncButton, text);
    }
  }

}

function createErrorSyncResult(message: string): SyncResult {
  const now = new Date().toISOString();
  return {
    created: 0,
    updated: 0,
    completed: 0,
    writtenBack: 0,
    failed: 1,
    skipped: 0,
    scanned: 0,
    rangeResults: [],
    rangeCursorOffsets: {},
    events: [{ time: now, level: "error", message }],
    failures: [{ message }],
    startedAt: now,
    finishedAt: now
  };
}
