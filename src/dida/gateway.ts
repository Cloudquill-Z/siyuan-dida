import type { DidaGateway } from "../core/types";
import { DidaCliClient } from "./cli";

export class DidaCliGateway implements DidaGateway {
  constructor(private readonly client: DidaCliClient) {}

  createTask(projectId: string, title: string) {
    return this.client.createTask(projectId, title);
  }

  async updateTaskTitle(projectId: string, taskId: string, title: string): Promise<void> {
    await this.client.updateTaskTitle(projectId, taskId, title);
  }

  async setTaskParent(projectId: string, taskId: string, parentTaskId: string): Promise<void> {
    await this.client.setTaskParent(projectId, taskId, parentTaskId);
  }

  completeTask(projectId: string, taskId: string) {
    return this.client.completeTask(projectId, taskId);
  }

  async listCompletedTaskIds(projectIds: string[]): Promise<Set<string>> {
    const tasks = await this.client.listCompletedTasks(projectIds);
    return new Set(tasks.map((task) => task.id));
  }
}
