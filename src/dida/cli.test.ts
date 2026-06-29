import { describe, expect, test } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDesktopPath,
  buildWindowsCmdInvocation,
  DidaCliClient,
  resolveDidaCommand,
  resolveWindowsCmdShim
} from "./cli";

describe("resolveDidaCommand", () => {
  test("uses the configured command when it runs", async () => {
    const result = await resolveDidaCommand("dida", async (command, args) => {
      expect(command).toBe("dida");
      expect(args).toEqual(["--version"]);
      return { stdout: "0.1.10", stderr: "" };
    });

    expect(result).toEqual({ command: "dida", version: "0.1.10" });
  });

  test("falls back to shell discovery when bare command is not on PATH", async () => {
    const calls: string[] = [];
    const result = await resolveDidaCommand(
      "dida",
      async (command, args) => {
        calls.push([command, ...args].join(" "));
        if (command === "dida") {
          throw new Error("not found");
        }
        if (args.includes("command -v dida")) {
          return { stdout: "/opt/homebrew/bin/dida\n", stderr: "" };
        }
        if (command === "/opt/homebrew/bin/dida") {
          return { stdout: "0.1.10\n", stderr: "" };
        }
        throw new Error("unexpected command");
      },
      "darwin"
    );

    expect(result).toEqual({ command: "/opt/homebrew/bin/dida", version: "0.1.10" });
    expect(calls).toContain("/bin/zsh -ilc command -v dida");
  });

  test("falls back to dida.cmd on Windows when the bare command is not runnable", async () => {
    const calls: string[] = [];
    const result = await resolveDidaCommand(
      "dida",
      async (command, args) => {
        calls.push([command, ...args].join(" "));
        if (command === "dida.cmd") {
          return { stdout: "0.1.10\n", stderr: "" };
        }
        throw new Error("not found");
      },
      "win32",
      "C:\\Users\\lance"
    );

    expect(result).toEqual({ command: "dida.cmd", version: "0.1.10" });
    expect(calls).toEqual(["dida --version", "dida.cmd --version"]);
  });

  test("uses where.exe discovery on Windows when command shims are outside common paths", async () => {
    const result = await resolveDidaCommand(
      "dida",
      async (command, args) => {
        if (command === "where.exe" && args[0] === "dida") {
          return { stdout: "D:\\Tools\\npm\\dida.cmd\n", stderr: "" };
        }
        if (command === "D:\\Tools\\npm\\dida.cmd") {
          return { stdout: "0.1.10\n", stderr: "" };
        }
        throw new Error("not found");
      },
      "win32",
      "C:\\Users\\lance"
    );

    expect(result).toEqual({ command: "D:\\Tools\\npm\\dida.cmd", version: "0.1.10" });
  });

  test("does not shell-discover absolute paths", async () => {
    await expect(
      resolveDidaCommand("/missing/dida", async () => {
        throw new Error("not found");
      })
    ).rejects.toThrow("Unable to run dida CLI");
  });
});

describe("buildDesktopPath", () => {
  test("adds common user binary locations for desktop-launched SiYuan", () => {
    const path = buildDesktopPath("/usr/bin:/bin", "/Users/lance", "darwin");

    expect(path.split(":")).toContain("/Users/lance/.hermes/node/bin");
    expect(path.split(":")).toContain("/opt/homebrew/bin");
    expect(path.split(":")).toContain("/usr/bin");
  });

  test("uses Windows path delimiter and common Windows locations", () => {
    const path = buildDesktopPath("C:\\Windows\\System32;C:\\Tools", "C:\\Users\\lance", "win32");
    const parts = path.split(";");

    expect(parts).toContain("C:\\Users\\lance\\.hermes\\node\\bin");
    expect(parts).toContain("C:\\Users\\lance\\AppData\\Roaming\\npm");
    expect(parts).toContain("C:\\Windows\\System32");
    expect(parts).not.toContain("C:\\Windows\\System32:C:\\Tools");
  });
});

describe("buildWindowsCmdInvocation", () => {
  test("quotes a task title with spaces as one Windows command argument", () => {
    const command = buildWindowsCmdInvocation("dida.cmd", [
      "task",
      "create",
      "--title",
      "解决问题：滴答同步失败 v3.7.0-rc.1",
      "--project",
      "project-1",
      "--json"
    ]);

    expect(command).toBe('dida.cmd task create --title "解决问题：滴答同步失败 v3.7.0-rc.1" --project project-1 --json');
  });
});

describe("resolveWindowsCmdShim", () => {
  test("turns an npm cmd shim into a direct node script invocation", () => {
    const root = join(tmpdir(), `siyuan-dida-${Date.now()}`);
    const npmDir = join(root, "npm");
    const scriptDir = join(npmDir, "node_modules", "@suibiji", "dida-cli", "dist");
    mkdirSync(scriptDir, { recursive: true });
    writeFileSync(
      join(npmDir, "dida.cmd"),
      '@ECHO off\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@suibiji\\dida-cli\\dist\\index.js" %*\r\n'
    );
    writeFileSync(join(scriptDir, "index.js"), "");

    try {
      expect(resolveWindowsCmdShim("dida.cmd", npmDir, "win32")).toEqual({
        command: "node",
        argsPrefix: [join(scriptDir, "index.js")]
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("DidaCliClient", () => {
  test("creates a task with json output", async () => {
    const client = new DidaCliClient("dida", async (command, args) => {
      expect(command).toBe("dida");
      expect(args).toEqual([
        "task",
        "create",
        "--title",
        "整理会议纪要",
        "--project",
        "project-1",
        "--json"
      ]);
      return { stdout: JSON.stringify({ id: "task-1", projectId: "project-1" }), stderr: "" };
    });

    await expect(client.createTask("project-1", "整理会议纪要")).resolves.toEqual({
      id: "task-1",
      projectId: "project-1"
    });
  });

  test("sets a task parent with the update command", async () => {
    const client = new DidaCliClient("dida", async (command, args) => {
      expect(command).toBe("dida");
      expect(args).toEqual([
        "task",
        "update",
        "task-2",
        "--id",
        "task-2",
        "--project",
        "project-1",
        "--parent-id",
        "task-1",
        "--json"
      ]);
      return { stdout: JSON.stringify({ id: "task-2", projectId: "project-1" }), stderr: "" };
    });

    await expect(client.setTaskParent("project-1", "task-2", "task-1")).resolves.toEqual({
      id: "task-2",
      projectId: "project-1"
    });
  });
});
