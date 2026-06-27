import { describe, expect, test } from "vitest";
import { buildDesktopPath, DidaCliClient, resolveDidaCommand } from "./cli";

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
    const result = await resolveDidaCommand("dida", async (command, args) => {
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
    });

    expect(result).toEqual({ command: "/opt/homebrew/bin/dida", version: "0.1.10" });
    expect(calls).toContain("/bin/zsh -ilc command -v dida");
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
    const path = buildDesktopPath("/usr/bin:/bin", "/Users/lance");

    expect(path.split(":")).toContain("/Users/lance/.hermes/node/bin");
    expect(path.split(":")).toContain("/opt/homebrew/bin");
    expect(path.split(":")).toContain("/usr/bin");
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
});
