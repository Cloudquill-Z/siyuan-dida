import { describe, expect, test } from "vitest";
import { DidaCurlClient, getCurlCommand } from "./curl";

describe("DidaCurlClient", () => {
  test("creates a task through curl proxy", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const client = new DidaCurlClient({
      tokenProvider: async () => "token-1",
      proxyUrl: "http://127.0.0.1:7890",
      runner: async (command, args) => {
        calls.push({ command, args });
        return {
          stdout: JSON.stringify({ id: "task-1", projectId: "project-1" }),
          stderr: ""
        };
      }
    });

    await expect(client.createTask("project-1", "测试任务")).resolves.toEqual({
      id: "task-1",
      projectId: "project-1"
    });
    expect(calls[0].command).toBe("curl");
    expect(calls[0].args).toContain("--proxy");
    expect(calls[0].args).toContain("http://127.0.0.1:7890");
    expect(calls[0].args).toContain("https://api.dida365.com/open/v1/task");
  });
});

describe("getCurlCommand", () => {
  test("uses curl.exe on Windows", () => {
    expect(getCurlCommand("win32")).toBe("curl.exe");
  });
});
