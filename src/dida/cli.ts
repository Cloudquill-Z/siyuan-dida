import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { delimiter } from "node:path";

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface ResolvedDidaCommand {
  command: string;
  version: string;
}

export interface DidaTask {
  id: string;
  projectId: string;
  title?: string;
  status?: number;
  completedTime?: string;
}

export interface DidaProject {
  id: string;
  name: string;
}

export const defaultRunner: CommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { env: { ...process.env, PATH: buildDesktopPath(process.env.PATH) }, timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

export function buildDesktopPath(currentPath = "", home = homedir(), platform = process.platform): string {
  const separator = platform === "win32" ? ";" : delimiter;
  const paths =
    platform === "win32"
      ? [
          `${home}\\.hermes\\node\\bin`,
          `${home}\\AppData\\Roaming\\npm`,
          `${home}\\scoop\\shims`,
          `${home}\\AppData\\Local\\Microsoft\\WindowsApps`,
          "C:\\Program Files\\nodejs",
          "C:\\Windows\\System32",
          ...currentPath.split(separator)
        ]
      : [
          `${home}/.hermes/node/bin`,
          `${home}/.opencode/bin`,
          `${home}/.local/bin`,
          `${home}/bin`,
          `${home}/.local/share/pnpm`,
          "/opt/homebrew/bin",
          "/opt/homebrew/sbin",
          "/usr/local/bin",
          "/usr/bin",
          "/bin",
          "/usr/sbin",
          "/sbin",
          ...currentPath.split(separator)
        ];
  return [...new Set(paths.filter(Boolean))].join(separator);
}

function isBareCommand(command: string): boolean {
  return !command.includes("/") && !command.includes("\\");
}

async function readVersion(command: string, runner: CommandRunner): Promise<string> {
  const result = await runner(command, ["--version"]);
  return result.stdout.trim();
}

export async function resolveDidaCommand(
  configuredCommand = "dida",
  runner: CommandRunner = defaultRunner
): Promise<ResolvedDidaCommand> {
  try {
    return {
      command: configuredCommand,
      version: await readVersion(configuredCommand, runner)
    };
  } catch (error) {
    if (!isBareCommand(configuredCommand)) {
      throw new Error(`Unable to run dida CLI: ${(error as Error).message}`);
    }
  }

  if (process.platform === "win32") {
    throw new Error(`Unable to run dida CLI. Tried ${configuredCommand}. 请确认 dida 已安装并在 PATH 中，或在设置里填写 dida.cmd 的绝对路径。`);
  }

  const errors: string[] = [];
  const discoveryCommands: Array<[string, string[]]> = [
    ["/bin/zsh", ["-ilc", "command -v dida"]],
    ["/bin/zsh", ["-lc", "command -v dida"]],
    ["/bin/bash", ["-ilc", "command -v dida"]],
    ["/bin/bash", ["-lc", "command -v dida"]]
  ];

  for (const [command, args] of discoveryCommands) {
    try {
      const result = await runner(command, args);
      const discovered = result.stdout.trim().split(/\r?\n/)[0];
      if (!discovered) {
        continue;
      }
      return {
        command: discovered,
        version: await readVersion(discovered, runner)
      };
    } catch (error) {
      errors.push(`${command} ${args.join(" ")}: ${(error as Error).message}`);
      // Try the next discovery strategy.
    }
  }

  throw new Error(`Unable to run dida CLI. Tried ${configuredCommand} and shell discovery. ${errors.join(" | ")}`);
}

function parseJson<T>(stdout: string): T {
  return JSON.parse(stdout) as T;
}

export class DidaCliClient {
  constructor(
    private readonly command: string,
    private readonly runner: CommandRunner = defaultRunner
  ) {}

  async testConnection(): Promise<string> {
    return readVersion(this.command, this.runner);
  }

  async listProjects(): Promise<DidaProject[]> {
    const result = await this.runner(this.command, ["project", "list", "--json"]);
    return parseJson<DidaProject[]>(result.stdout);
  }

  async createTask(projectId: string, title: string): Promise<DidaTask> {
    const result = await this.runner(this.command, [
      "task",
      "create",
      "--title",
      title,
      "--project",
      projectId,
      "--json"
    ]);
    return parseJson<DidaTask>(result.stdout);
  }

  async updateTaskTitle(projectId: string, taskId: string, title: string): Promise<DidaTask> {
    const result = await this.runner(this.command, [
      "task",
      "update",
      taskId,
      "--id",
      taskId,
      "--project",
      projectId,
      "--title",
      title,
      "--json"
    ]);
    return parseJson<DidaTask>(result.stdout);
  }

  async completeTask(projectId: string, taskId: string): Promise<void> {
    await this.runner(this.command, ["task", "complete", projectId, taskId]);
  }

  async listCompletedTasks(projectIds: string[]): Promise<DidaTask[]> {
    const args = ["task", "completed", "--json"];
    if (projectIds.length > 0) {
      args.push("--projects", projectIds.join(","));
    }
    const result = await this.runner(this.command, args);
    return parseJson<DidaTask[]>(result.stdout);
  }
}
