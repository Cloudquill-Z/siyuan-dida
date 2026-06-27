import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandResult } from "./cli";
import type { DidaProject, DidaTask } from "./cli";

const BASE_URL = "https://api.dida365.com/open/v1";

type CurlRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface DidaCurlClientOptions {
  proxyUrl?: string;
  tokenProvider?: () => Promise<string>;
  runner?: CurlRunner;
}

export const defaultCurlRunner: CurlRunner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 45_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || stdout.trim() || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

export function getCurlCommand(platform = process.platform): string {
  return platform === "win32" ? "curl.exe" : "curl";
}

export async function readDidaCliToken(): Promise<string> {
  const configPath = join(homedir(), ".config", "dida-cli", "config.json");
  const content = await readFile(configPath, "utf-8");
  const config = JSON.parse(content) as { access_token?: string };
  if (!config.access_token) {
    throw new Error("未找到 dida CLI token，请先运行 dida auth login");
  }
  return config.access_token;
}

export class DidaCurlClient {
  private readonly tokenProvider: () => Promise<string>;
  private readonly runner: CurlRunner;
  private readonly proxyUrl: string;

  constructor(options: DidaCurlClientOptions = {}) {
    this.tokenProvider = options.tokenProvider ?? readDidaCliToken;
    this.runner = options.runner ?? defaultCurlRunner;
    this.proxyUrl = options.proxyUrl ?? "";
  }

  async listProjects(): Promise<DidaProject[]> {
    return this.request<DidaProject[]>("GET", "/project");
  }

  async createTask(projectId: string, title: string): Promise<DidaTask> {
    return this.request<DidaTask>("POST", "/task", { title, projectId });
  }

  async updateTaskTitle(projectId: string, taskId: string, title: string): Promise<DidaTask> {
    return this.request<DidaTask>("POST", `/task/${taskId}`, { id: taskId, projectId, title });
  }

  async completeTask(projectId: string, taskId: string): Promise<void> {
    await this.request<void>("POST", `/project/${projectId}/task/${taskId}/complete`);
  }

  async listCompletedTasks(projectIds: string[]): Promise<DidaTask[]> {
    return this.request<DidaTask[]>("POST", "/task/completed", {
      projectIds: projectIds.length > 0 ? projectIds : undefined
    });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.tokenProvider();
    const args = [
      "-sS",
      "--fail-with-body",
      "--connect-timeout",
      "20",
      "-X",
      method,
      "-H",
      `Authorization: Bearer ${token}`,
      "-H",
      "Content-Type: application/json"
    ];

    if (this.proxyUrl) {
      args.push("--proxy", this.proxyUrl);
    }

    if (body !== undefined) {
      args.push("-d", JSON.stringify(body));
    }

    args.push(`${BASE_URL}${path}`);
    const result = await this.runner(getCurlCommand(), args);
    if (!result.stdout.trim()) {
      return undefined as T;
    }
    return JSON.parse(result.stdout) as T;
  }
}
