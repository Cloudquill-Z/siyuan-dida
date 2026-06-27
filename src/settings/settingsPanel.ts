import { showMessage } from "siyuan";
import type { SyncRange } from "../core/types";
import { DidaCliClient, type DidaProject, resolveDidaCommand } from "../dida/cli";
import { DidaCurlClient } from "../dida/curl";
import { listNotebooks, type SiYuanNotebook } from "../siyuan/api";
import type { PluginSettings } from "./defaults";
import { formatSyncLogs } from "./logFormat";
import { createEmptyRange, prepareRangesForSave } from "./ranges";

export interface SettingsPanelOptions {
  settings: PluginSettings;
  onSave(settings: PluginSettings): Promise<void>;
}

export function buildSettingsPanel(options: SettingsPanelOptions): HTMLElement {
  const state = {
    ranges: options.settings.ranges.length > 0 ? [...options.settings.ranges] : [createEmptyRange(1)],
    notebooks: [] as SiYuanNotebook[],
    projects: [] as DidaProject[]
  };

  const root = document.createElement("div");
  root.className = "dida-sync-settings";
  root.innerHTML = `
    <div class="dida-sync-summary">
      <div>
        <div class="dida-sync-title">连接与同步</div>
        <div class="dida-sync-muted">每台设备会自动发现本机 dida，也可以手动指定命令或绝对路径。</div>
      </div>
      <button class="b3-button b3-button--text" data-action="save">保存设置</button>
    </div>

    <div class="dida-sync-grid">
      <section class="dida-sync-section">
        <div class="dida-sync-section__title">Dida CLI</div>
        <label class="dida-sync-field">
          <span>命令或路径</span>
          <input class="b3-text-field" data-field="cliCommand" placeholder="dida" />
        </label>
        <label class="dida-sync-toggle">
          <input type="checkbox" data-field="useProxy" />
          <span>通过代理访问滴答 API</span>
        </label>
        <label class="dida-sync-field">
          <span>代理地址</span>
          <input class="b3-text-field" data-field="proxyUrl" placeholder="http://127.0.0.1:7890" />
        </label>
        <div class="dida-sync-actions">
          <button class="b3-button" data-action="test">测试连接</button>
          <button class="b3-button b3-button--outline" data-action="loadProjects">刷新滴答清单</button>
        </div>
      </section>

      <section class="dida-sync-section">
        <div class="dida-sync-section__title">自动同步</div>
        <label class="dida-sync-toggle">
          <input type="checkbox" data-field="autoSync" />
          <span>开启自动同步</span>
        </label>
        <label class="dida-sync-field">
          <span>同步间隔（秒）</span>
          <input class="b3-text-field" data-field="syncIntervalSeconds" type="number" min="5" />
        </label>
      </section>
    </div>

    <section class="dida-sync-section">
      <div class="dida-sync-section__bar">
        <div>
          <div class="dida-sync-section__title">同步范围</div>
          <div class="dida-sync-muted">选择思源笔记本、文档路径和目标滴答清单。</div>
        </div>
        <div class="dida-sync-actions">
          <button class="b3-button b3-button--outline" data-action="loadNotebooks">刷新笔记本</button>
          <button class="b3-button" data-action="addRange">新增范围</button>
        </div>
      </div>
      <div class="dida-sync-ranges" data-field="ranges"></div>
    </section>

    <section class="dida-sync-section">
      <div class="dida-sync-section__bar">
        <div>
          <div class="dida-sync-section__title">同步日志</div>
          <div class="dida-sync-muted">记录扫描范围、候选任务数、跳过原因和失败信息。</div>
        </div>
        <div class="dida-sync-actions">
          <button class="b3-button b3-button--outline" data-action="copyLogs">复制日志</button>
          <button class="b3-button b3-button--outline" data-action="clearLogs">清空日志</button>
        </div>
      </div>
      <pre class="dida-sync-log" data-field="logs"></pre>
    </section>
  `;

  const cliCommand = root.querySelector<HTMLInputElement>('[data-field="cliCommand"]')!;
  const useProxy = root.querySelector<HTMLInputElement>('[data-field="useProxy"]')!;
  const proxyUrl = root.querySelector<HTMLInputElement>('[data-field="proxyUrl"]')!;
  const autoSync = root.querySelector<HTMLInputElement>('[data-field="autoSync"]')!;
  const syncIntervalSeconds = root.querySelector<HTMLInputElement>('[data-field="syncIntervalSeconds"]')!;
  const rangesEl = root.querySelector<HTMLElement>('[data-field="ranges"]')!;
  const logs = root.querySelector<HTMLElement>('[data-field="logs"]')!;

  cliCommand.value = options.settings.cliCommand;
  useProxy.checked = options.settings.useProxy;
  proxyUrl.value = options.settings.proxyUrl;
  autoSync.checked = options.settings.autoSync;
  syncIntervalSeconds.value = String(options.settings.syncIntervalSeconds);
  logs.textContent = formatSyncLogs(options.settings.logs.slice(0, 10));

  const renderRanges = () => {
    rangesEl.replaceChildren(...state.ranges.map((range, index) => renderRange(range, index, state, renderRanges)));
  };

  root.querySelector('[data-action="test"]')?.addEventListener("click", async () => {
    try {
      const resolved = await resolveDidaCommand(cliCommand.value || "dida");
      showMessage(`Dida CLI 可用：${resolved.command} (${resolved.version})`);
      state.projects = useProxy.checked
        ? await new DidaCurlClient({ proxyUrl: proxyUrl.value }).listProjects()
        : await new DidaCliClient(resolved.command).listProjects();
      renderRanges();
    } catch (error) {
      showMessage(`Dida CLI 不可用：${(error as Error).message}`, 5000, "error");
    }
  });

  root.querySelector('[data-action="loadProjects"]')?.addEventListener("click", async () => {
    try {
      const resolved = await resolveDidaCommand(cliCommand.value || "dida");
      state.projects = useProxy.checked
        ? await new DidaCurlClient({ proxyUrl: proxyUrl.value }).listProjects()
        : await new DidaCliClient(resolved.command).listProjects();
      renderRanges();
      showMessage("滴答清单已刷新");
    } catch (error) {
      showMessage(`刷新滴答清单失败：${(error as Error).message}`, 5000, "error");
    }
  });

  root.querySelector('[data-action="loadNotebooks"]')?.addEventListener("click", async () => {
    try {
      state.notebooks = await listNotebooks();
      renderRanges();
      showMessage("笔记本已刷新");
    } catch (error) {
      showMessage(`刷新笔记本失败：${(error as Error).message}`, 5000, "error");
    }
  });

  root.querySelector('[data-action="addRange"]')?.addEventListener("click", () => {
    state.ranges.push(createEmptyRange(state.ranges.length + 1));
    renderRanges();
  });

  root.querySelector('[data-action="save"]')?.addEventListener("click", async () => {
    try {
      const ranges = prepareRangesForSave(state.ranges);
      await options.onSave({
        ...options.settings,
        cliCommand: cliCommand.value || "dida",
        useProxy: useProxy.checked,
        proxyUrl: proxyUrl.value.trim(),
        autoSync: autoSync.checked,
        syncIntervalSeconds: Number(syncIntervalSeconds.value || 15),
        ranges
      });
      showMessage("滴答同步设置已保存");
    } catch (error) {
      showMessage(`设置保存失败：${(error as Error).message}`, 5000, "error");
    }
  });

  root.querySelector('[data-action="copyLogs"]')?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(formatSyncLogs(options.settings.logs.slice(0, 20)));
      showMessage("同步日志已复制");
    } catch (error) {
      showMessage(`复制日志失败：${(error as Error).message}`, 5000, "error");
    }
  });

  root.querySelector('[data-action="clearLogs"]')?.addEventListener("click", async () => {
    try {
      options.settings.logs = [];
      logs.textContent = formatSyncLogs([]);
      await options.onSave(options.settings);
      showMessage("同步日志已清空");
    } catch (error) {
      showMessage(`清空日志失败：${(error as Error).message}`, 5000, "error");
    }
  });

  renderRanges();
  void listNotebooks()
    .then((notebooks) => {
      state.notebooks = notebooks;
      renderRanges();
    })
    .catch(() => undefined);

  void resolveDidaCommand(options.settings.resolvedCliPath || options.settings.cliCommand || "dida")
    .then((resolved) =>
      options.settings.useProxy
        ? new DidaCurlClient({ proxyUrl: options.settings.proxyUrl }).listProjects()
        : new DidaCliClient(resolved.command).listProjects()
    )
    .then((projects) => {
      state.projects = projects;
      renderRanges();
    })
    .catch(() => undefined);

  return root;
}

function renderRange(
  range: SyncRange,
  index: number,
  state: { ranges: SyncRange[]; notebooks: SiYuanNotebook[]; projects: DidaProject[] },
  rerender: () => void
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "dida-sync-range";
  wrapper.innerHTML = `
    <div class="dida-sync-range__header">
      <div>
        <div class="dida-sync-range__title">${escapeHtml(range.name || `同步范围 ${index + 1}`)}</div>
        <div class="dida-sync-muted">范围 ${index + 1}</div>
      </div>
      <button class="b3-button b3-button--outline" data-action="removeRange">删除</button>
    </div>
    <div class="dida-sync-range__grid">
      <label class="dida-sync-field">
        <span>范围名称</span>
        <input class="b3-text-field" data-field="name" />
      </label>
      <label class="dida-sync-field">
        <span>笔记本</span>
        ${renderNotebookControl(range, state.notebooks)}
      </label>
      <label class="dida-sync-field">
        <span>文档路径</span>
        <input class="b3-text-field" data-field="hpathPrefix" placeholder="/工作日志" />
      </label>
      <label class="dida-sync-field">
        <span>滴答清单</span>
        ${renderProjectControl(range, state.projects)}
      </label>
    </div>
    <label class="dida-sync-toggle dida-sync-toggle--compact">
      <input type="checkbox" data-field="includeChildren" />
      <span>包含子文档</span>
    </label>
  `;

  bindInput(wrapper, "name", range, "name");
  bindInput(wrapper, "notebookId", range, "notebookId");
  bindInput(wrapper, "hpathPrefix", range, "hpathPrefix");
  bindInput(wrapper, "targetProjectId", range, "targetProjectId");

  const includeChildren = wrapper.querySelector<HTMLInputElement>('[data-field="includeChildren"]')!;
  includeChildren.checked = range.includeChildren;
  includeChildren.addEventListener("change", () => {
    range.includeChildren = includeChildren.checked;
  });

  wrapper.querySelector('[data-field="targetProjectId"]')?.addEventListener("change", (event) => {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    const project = state.projects.find((item) => item.id === value);
    range.targetProjectName = project?.name ?? range.targetProjectName;
  });

  wrapper.querySelector('[data-action="removeRange"]')?.addEventListener("click", () => {
    state.ranges.splice(index, 1);
    if (state.ranges.length === 0) {
      state.ranges.push(createEmptyRange(1));
    }
    rerender();
  });

  return wrapper;
}

function renderNotebookControl(range: SyncRange, notebooks: SiYuanNotebook[]): string {
  if (notebooks.length === 0) {
    return `<input class="b3-text-field" data-field="notebookId" placeholder="笔记本 ID" value="${escapeAttribute(range.notebookId)}" />`;
  }

  const options = [
    `<option value="">选择笔记本</option>`,
    ...notebooks.map(
      (notebook) =>
        `<option value="${escapeAttribute(notebook.id)}" ${notebook.id === range.notebookId ? "selected" : ""}>${escapeHtml(notebook.name)}</option>`
    )
  ].join("");
  return `<select class="b3-select fn__block" data-field="notebookId">${options}</select>`;
}

function renderProjectControl(range: SyncRange, projects: DidaProject[]): string {
  if (projects.length === 0) {
    return `<input class="b3-text-field" data-field="targetProjectId" placeholder="滴答清单 ID" value="${escapeAttribute(range.targetProjectId)}" />`;
  }

  const options = [
    `<option value="">选择滴答清单</option>`,
    ...projects.map(
      (project) =>
        `<option value="${escapeAttribute(project.id)}" ${project.id === range.targetProjectId ? "selected" : ""}>${escapeHtml(project.name)}</option>`
    )
  ].join("");
  return `<select class="b3-select fn__block" data-field="targetProjectId">${options}</select>`;
}

function bindInput<K extends keyof SyncRange>(root: HTMLElement, field: string, range: SyncRange, key: K) {
  const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${field}"]`);
  if (!input) {
    return;
  }
  input.value = String(range[key] ?? "");
  input.addEventListener("input", () => {
    range[key] = input.value as SyncRange[K];
  });
  input.addEventListener("change", () => {
    range[key] = input.value as SyncRange[K];
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
