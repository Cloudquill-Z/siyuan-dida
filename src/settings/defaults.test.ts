import { describe, expect, test } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings, settingsForSave } from "./defaults";

describe("settingsForSave", () => {
  test("defaults legacy settings to creating new tasks with today's date", () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      newTaskDate: undefined
    });

    expect(settings.newTaskDate).toBe("today");
  });

  test("keeps a resolved CLI path when the configured command is unchanged", () => {
    const current = normalizeSettings({
      ...DEFAULT_SETTINGS,
      cliCommand: "dida",
      resolvedCliPath: "/opt/homebrew/bin/dida",
      resolvedCliPaths: {
        "darwin:desk-1": "/opt/homebrew/bin/dida"
      }
    });

    expect(settingsForSave(current, { cliCommand: "dida" }).resolvedCliPath).toBe("/opt/homebrew/bin/dida");
    expect(settingsForSave(current, { cliCommand: "dida" }).resolvedCliPaths).toEqual({
      "darwin:desk-1": "/opt/homebrew/bin/dida"
    });
  });

  test("clears resolved CLI path caches when the configured command changes", () => {
    const current = normalizeSettings({
      ...DEFAULT_SETTINGS,
      cliCommand: "dida",
      resolvedCliPath: "/opt/homebrew/bin/dida",
      resolvedCliPaths: {
        "darwin:desk-1": "/opt/homebrew/bin/dida",
        "win32:desk-2": "C:\\Users\\me\\AppData\\Roaming\\npm\\dida.cmd"
      }
    });

    const next = settingsForSave(current, { cliCommand: "/custom/bin/dida" });

    expect(next.resolvedCliPath).toBe("");
    expect(next.resolvedCliPaths).toEqual({});
  });
});
