import type { DidaGateway } from "../core/types";
import { DidaCurlClient } from "./curl";

export class DidaCurlGateway implements DidaGateway {
  constructor(private readonly client: DidaCurlClient) {}

  createTask(projectId: string, title: string) {
    return this.client.createTask(projectId, title);
  }

  async updateTaskTitle(projectId: string, taskId: string, title: string): Promise<void> {
    await this.client.updateTaskTitle(projectId, taskId, title);
  }

  completeTask(projectId: string, taskId: string) {
    return this.client.completeTask(projectId, taskId);
  }

  async listCompletedTaskIds(projectIds: string[]): Promise<Set<string>> {
    const tasks = await this.client.listCompletedTasks(projectIds);
    return new Set(tasks.map((task) => task.id));
  }
}
