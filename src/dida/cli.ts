import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";
import type { CreateDidaTaskOptions } from "../core/types";

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface ResolvedDidaCommand {
  command: string;
  version: string;
}

export interface WindowsCmdShim {
  command: string;
  argsPrefix: string[];
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
    const desktopPath = buildDesktopPath(process.env.PATH);
    const shim = resolveWindowsCmdShim(command, desktopPath);
    const commandPath = shim?.command ?? (shouldUseWindowsShell(command) ? "cmd.exe" : command);
    const commandArgs = shim
      ? [...shim.argsPrefix, ...args]
      : shouldUseWindowsShell(command)
        ? ["/d", "/s", "/c", buildWindowsCmdInvocation(command, args)]
        : args;
    execFile(commandPath, commandArgs, { env: { ...process.env, PATH: desktopPath }, timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

function shouldUseWindowsShell(command: string, platform = process.platform): boolean {
  return platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
}

export function resolveWindowsCmdShim(
  command: string,
  currentPath = buildDesktopPath(process.env.PATH),
  platform = process.platform
): WindowsCmdShim | undefined {
  if (!shouldUseWindowsShell(command, platform)) {
    return undefined;
  }

  const shimPath = findWindowsCommandPath(command, currentPath);
  if (!shimPath) {
    return undefined;
  }

  let content = "";
  try {
    content = readFileSync(shimPath, "utf8");
  } catch {
    return undefined;
  }

  const scriptMatch = content.match(/"%dp0%\\([^"]+?\.js)"/i);
  if (!scriptMatch) {
    return undefined;
  }

  const baseDir = dirname(shimPath);
  const scriptPath = join(baseDir, scriptMatch[1].replace(/\\/g, sep));
  if (!existsSync(scriptPath)) {
    return undefined;
  }

  const localNode = join(baseDir, "node.exe");
  return {
    command: existsSync(localNode) ? localNode : "node",
    argsPrefix: [scriptPath]
  };
}

function findWindowsCommandPath(command: string, currentPath: string): string | undefined {
  const hasPathSeparator = command.includes("/") || command.includes("\\");
  const candidates = hasPathSeparator ? [command] : currentPath.split(";").map((path) => join(path, command));
  return candidates.find((candidate) => existsSync(candidate));
}

export function buildWindowsCmdInvocation(command: string, args: string[]): string {
  return [command, ...args].map(quoteWindowsCmdArgument).join(" ");
}

function quoteWindowsCmdArgument(value: string): string {
  if (value.length > 0 && !/[\s"&|<>()^%!]/.test(value)) {
    return value;
  }
  return `"${value.replace(/(["&|<>()^%!])/g, "^$1")}"`;
}

export function buildDesktopPath(currentPath = "", home = homedir(), platform = process.platform): string {
  const separator = platform === "win32" ? ";" : ":";
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

async function tryReadVersion(command: string, runner: CommandRunner): Promise<ResolvedDidaCommand | undefined> {
  try {
    return {
      command,
      version: await readVersion(command, runner)
    };
  } catch {
    return undefined;
  }
}

export async function resolveDidaCommand(
  configuredCommand = "dida",
  runner: CommandRunner = defaultRunner,
  platform = process.platform,
  home = homedir()
): Promise<ResolvedDidaCommand> {
  try {
    return {
      command: configuredCommand,
      version: await readVersion(configuredCommand, runner)
    };
  } catch (error) {
    if (!isBareCommand(configuredCommand)) {
      if (platform === "win32") {
        return resolveWindowsDidaCommand("dida", runner, home, [configuredCommand]);
      }
      throw new Error(`Unable to run dida CLI: ${(error as Error).message}`);
    }
  }

  if (platform === "win32") {
    return resolveWindowsDidaCommand(configuredCommand, runner, home);
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

async function resolveWindowsDidaCommand(
  configuredCommand: string,
  runner: CommandRunner,
  home: string,
  previousTried: string[] = []
): Promise<ResolvedDidaCommand> {
  const tried = new Set<string>([...previousTried, configuredCommand]);
  const candidates = [
    `${configuredCommand}.cmd`,
    `${configuredCommand}.exe`,
    join(home, "AppData", "Roaming", "npm", `${configuredCommand}.cmd`),
    join(home, "scoop", "shims", `${configuredCommand}.cmd`)
  ];

  for (const candidate of candidates) {
    tried.add(candidate);
    const resolved = await tryReadVersion(candidate, runner);
    if (resolved) {
      return resolved;
    }
  }

  for (const commandName of [configuredCommand, `${configuredCommand}.cmd`]) {
    try {
      const result = await runner("where.exe", [commandName]);
      const discoveredCommands = result.stdout.trim().split(/\r?\n/).filter(Boolean);
      for (const discovered of discoveredCommands) {
        tried.add(discovered);
        const resolved = await tryReadVersion(discovered, runner);
        if (resolved) {
          return resolved;
        }
      }
    } catch {
      // Try the next Windows discovery strategy.
    }
  }

  throw new Error(
    `Unable to run dida CLI. Tried ${Array.from(tried).join(", ")}. 请确认 dida 已安装并在 PATH 中，或在设置里填写 dida.cmd 的绝对路径。`
  );
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

  async createTask(projectId: string, title: string, options: CreateDidaTaskOptions = {}): Promise<DidaTask> {
    const args = [
      "task",
      "create",
      "--title",
      title,
      "--project",
      projectId
    ];
    if (options.content) {
      args.push("--content", options.content);
    }
    if (options.allDay) {
      args.push("--all-day");
    }
    if (options.startDate) {
      args.push("--start-date", options.startDate);
    }
    args.push("--json");
    const result = await this.runner(this.command, args);
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

  async setTaskParent(projectId: string, taskId: string, parentTaskId: string): Promise<DidaTask> {
    const result = await this.runner(this.command, [
      "task",
      "update",
      taskId,
      "--id",
      taskId,
      "--project",
      projectId,
      "--parent-id",
      parentTaskId,
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
