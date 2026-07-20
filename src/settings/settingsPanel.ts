import { showMessage } from "siyuan";
import type { SyncRange } from "../core/types";
import { DidaCliClient, type DidaProject, resolveDidaCommand } from "../dida/cli";
import { listNotebooks, type SiYuanNotebook } from "../siyuan/api";
import { settingsForSave, type PluginSettings } from "./defaults";
import { getResolvedCliPathForCurrentDevice, withResolvedCliPathForCurrentDevice } from "./deviceCli";
import { formatSyncLogs } from "./logFormat";
import { createEmptyRange, prepareRangesForSave } from "./ranges";
import type { Translate } from "../i18n";

export interface SettingsPanelOptions {
  settings: PluginSettings;
  t: Translate;
  onSave(settings: PluginSettings): Promise<void>;
}

export function buildSettingsPanel(options: SettingsPanelOptions): HTMLElement {
  const { t } = options;
  const state = {
    ranges: options.settings.ranges.length > 0 ? [...options.settings.ranges] : [createEmptyRange(1)],
    notebooks: [] as SiYuanNotebook[],
    projects: [] as DidaProject[],
    t
  };

  const root = document.createElement("div");
  root.className = "dida-sync-settings";
  root.innerHTML = `
    <div class="dida-sync-summary">
      <div>
        <div class="dida-sync-title">${t("connectionAndSync")}</div>
        <div class="dida-sync-muted">${t("deviceDiscovery")}</div>
      </div>
      <div class="dida-sync-summary__actions">
        <span class="dida-sync-version">v${escapeHtml(__PLUGIN_VERSION__)}</span>
        <button class="b3-button b3-button--text" data-action="save">${t("saveSettings")}</button>
      </div>
    </div>

    <div class="dida-sync-grid">
      <section class="dida-sync-section">
        <div class="dida-sync-section__title">Dida CLI</div>
        <label class="dida-sync-field">
          <span>${t("commandOrPath")}</span>
          <input class="b3-text-field" data-field="cliCommand" placeholder="dida" />
        </label>
        <div class="dida-sync-actions">
          <button class="b3-button" data-action="test">${t("testConnection")}</button>
          <button class="b3-button b3-button--outline" data-action="loadProjects">${t("refreshProjects")}</button>
        </div>
      </section>

      <section class="dida-sync-section">
        <div class="dida-sync-section__title">${t("automaticSync")}</div>
        <label class="dida-sync-toggle">
          <input type="checkbox" data-field="autoSync" />
          <span>${t("enableAutomaticSync")}</span>
        </label>
        <label class="dida-sync-field">
          <span>${t("syncInterval")}</span>
          <input class="b3-text-field" data-field="syncIntervalSeconds" type="number" min="5" />
        </label>
        <label class="dida-sync-field">
          <span>${t("newTaskDate")}</span>
          <select class="b3-select fn__block" data-field="newTaskDate">
            <option value="today">${t("newTaskDateToday")}</option>
            <option value="none">${t("newTaskDateNone")}</option>
          </select>
        </label>
      </section>
    </div>

    <section class="dida-sync-section">
      <div class="dida-sync-section__bar">
        <div>
          <div class="dida-sync-section__title">${t("syncRanges")}</div>
          <div class="dida-sync-muted">${t("selectSourceAndTarget")}</div>
        </div>
        <div class="dida-sync-actions">
          <button class="b3-button b3-button--outline" data-action="loadNotebooks">${t("refreshNotebooks")}</button>
          <button class="b3-button" data-action="addRange">${t("addRange")}</button>
        </div>
      </div>
      <div class="dida-sync-ranges" data-field="ranges"></div>
    </section>

    <section class="dida-sync-section">
      <div class="dida-sync-section__bar">
        <div>
          <div class="dida-sync-section__title">${t("syncLogs")}</div>
          <div class="dida-sync-muted">${t("syncLogHelp")}</div>
        </div>
        <div class="dida-sync-actions">
          <button class="b3-button b3-button--outline" data-action="copyLogs">${t("copyLogs")}</button>
          <button class="b3-button b3-button--outline" data-action="clearLogs">${t("clearLogs")}</button>
        </div>
      </div>
      <pre class="dida-sync-log" data-field="logs"></pre>
    </section>
  `;

  const cliCommand = root.querySelector<HTMLInputElement>('[data-field="cliCommand"]')!;
  const autoSync = root.querySelector<HTMLInputElement>('[data-field="autoSync"]')!;
  const syncIntervalSeconds = root.querySelector<HTMLInputElement>('[data-field="syncIntervalSeconds"]')!;
  const newTaskDate = root.querySelector<HTMLSelectElement>('[data-field="newTaskDate"]')!;
  const rangesEl = root.querySelector<HTMLElement>('[data-field="ranges"]')!;
  const logs = root.querySelector<HTMLElement>('[data-field="logs"]')!;

  cliCommand.value = options.settings.cliCommand;
  autoSync.checked = options.settings.autoSync;
  syncIntervalSeconds.value = String(options.settings.syncIntervalSeconds);
  newTaskDate.value = options.settings.newTaskDate;
  logs.textContent = formatSyncLogs(options.settings.logs.slice(0, 10));

  const renderRanges = () => {
    rangesEl.replaceChildren(...state.ranges.map((range, index) => renderRange(range, index, state, renderRanges)));
  };

  const rememberResolvedCliPath = async (resolvedCommand: string) => {
    options.settings = withResolvedCliPathForCurrentDevice(options.settings, resolvedCommand);
    await options.onSave(options.settings);
  };

  root.querySelector('[data-action="test"]')?.addEventListener("click", async () => {
    try {
      const resolved = await resolveDidaCommand(cliCommand.value || "dida");
      await rememberResolvedCliPath(resolved.command);
      showMessage(t("cliAvailable", { command: resolved.command, version: resolved.version }));
      state.projects = await new DidaCliClient(resolved.command).listProjects();
      renderRanges();
    } catch (error) {
      showMessage(t("cliUnavailable", { message: (error as Error).message }), 5000, "error");
    }
  });

  root.querySelector('[data-action="loadProjects"]')?.addEventListener("click", async () => {
    try {
      const resolved = await resolveDidaCommand(cliCommand.value || "dida");
      await rememberResolvedCliPath(resolved.command);
      state.projects = await new DidaCliClient(resolved.command).listProjects();
      renderRanges();
      showMessage(t("projectsRefreshed"));
    } catch (error) {
      showMessage(t("projectsRefreshFailed", { message: (error as Error).message }), 5000, "error");
    }
  });

  root.querySelector('[data-action="loadNotebooks"]')?.addEventListener("click", async () => {
    try {
      state.notebooks = await listNotebooks();
      renderRanges();
      showMessage(t("notebooksRefreshed"));
    } catch (error) {
      showMessage(t("notebooksRefreshFailed", { message: (error as Error).message }), 5000, "error");
    }
  });

  root.querySelector('[data-action="addRange"]')?.addEventListener("click", () => {
    state.ranges.push(createEmptyRange(state.ranges.length + 1));
    renderRanges();
  });

  root.querySelector('[data-action="save"]')?.addEventListener("click", async () => {
    try {
      const ranges = prepareRangesForSave(state.ranges);
      await options.onSave(settingsForSave(options.settings, {
        cliCommand: cliCommand.value || "dida",
        autoSync: autoSync.checked,
        newTaskDate: newTaskDate.value === "none" ? "none" : "today",
        syncIntervalSeconds: Number(syncIntervalSeconds.value || 15),
        ranges
      }));
      showMessage(t("settingsSaved"));
    } catch (error) {
      showMessage(t("settingsSaveFailed", { message: (error as Error).message }), 5000, "error");
    }
  });

  root.querySelector('[data-action="copyLogs"]')?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(formatSyncLogs(options.settings.logs.slice(0, 20)));
      showMessage(t("logsCopied"));
    } catch (error) {
      showMessage(t("logsCopyFailed", { message: (error as Error).message }), 5000, "error");
    }
  });

  root.querySelector('[data-action="clearLogs"]')?.addEventListener("click", async () => {
    try {
      options.settings.logs = [];
      logs.textContent = formatSyncLogs([]);
      await options.onSave(options.settings);
      showMessage(t("logsCleared"));
    } catch (error) {
      showMessage(t("logsClearFailed", { message: (error as Error).message }), 5000, "error");
    }
  });

  renderRanges();
  void listNotebooks()
    .then((notebooks) => {
      state.notebooks = notebooks;
      renderRanges();
    })
    .catch(() => undefined);

  void resolveDidaCommand(getResolvedCliPathForCurrentDevice(options.settings) || options.settings.cliCommand || "dida")
    .then((resolved) => new DidaCliClient(resolved.command).listProjects())
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
  state: { ranges: SyncRange[]; notebooks: SiYuanNotebook[]; projects: DidaProject[]; t: Translate },
  rerender: () => void
): HTMLElement {
  const wrapper = document.createElement("div");
  const { t } = state;
  wrapper.className = "dida-sync-range";
  wrapper.innerHTML = `
    <div class="dida-sync-range__header">
      <div>
        <div class="dida-sync-range__title">${escapeHtml(range.name || t("rangeFallback", { number: index + 1 }))}</div>
        <div class="dida-sync-muted">${t("rangeNumber", { number: index + 1 })}</div>
      </div>
      <button class="b3-button b3-button--outline" data-action="removeRange">${t("delete")}</button>
    </div>
    <div class="dida-sync-range__grid">
      <label class="dida-sync-field">
        <span>${t("rangeName")}</span>
        <input class="b3-text-field" data-field="name" />
      </label>
      <label class="dida-sync-field">
        <span>${t("notebook")}</span>
        ${renderNotebookControl(range, state.notebooks, t)}
      </label>
      <label class="dida-sync-field">
        <span>${t("documentPath")}</span>
        <input class="b3-text-field" data-field="hpathPrefix" placeholder="${t("documentPathPlaceholder")}" />
      </label>
      <label class="dida-sync-field">
        <span>${t("didaList")}</span>
        ${renderProjectControl(range, state.projects, t)}
      </label>
    </div>
    <label class="dida-sync-toggle dida-sync-toggle--compact">
      <input type="checkbox" data-field="includeChildren" />
      <span>${t("includeChildDocuments")}</span>
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

function renderNotebookControl(range: SyncRange, notebooks: SiYuanNotebook[], t: Translate): string {
  if (notebooks.length === 0) {
    return `<input class="b3-text-field" data-field="notebookId" placeholder="${t("notebookId")}" value="${escapeAttribute(range.notebookId)}" />`;
  }

  const options = [
    `<option value="">${t("selectNotebook")}</option>`,
    ...notebooks.map(
      (notebook) =>
        `<option value="${escapeAttribute(notebook.id)}" ${notebook.id === range.notebookId ? "selected" : ""}>${escapeHtml(notebook.name)}</option>`
    )
  ].join("");
  return `<select class="b3-select fn__block" data-field="notebookId">${options}</select>`;
}

function renderProjectControl(range: SyncRange, projects: DidaProject[], t: Translate): string {
  if (projects.length === 0) {
    return `<input class="b3-text-field" data-field="targetProjectId" placeholder="${t("didaListId")}" value="${escapeAttribute(range.targetProjectId)}" />`;
  }

  const options = [
    `<option value="">${t("selectDidaList")}</option>`,
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
