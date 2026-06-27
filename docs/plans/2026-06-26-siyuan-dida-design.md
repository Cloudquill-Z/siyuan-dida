# SiYuan Dida Sync Design

## Goal

Build a SiYuan desktop plugin that syncs Markdown todo blocks in configured SiYuan document ranges to TickTick/Dida through the local `dida` CLI.

## Scope

The first version targets SiYuan desktop only. It supports manual sync, optional polling, one or more configured sync ranges, creating Dida tasks from unsynced SiYuan todos, syncing completion from SiYuan to Dida, syncing completion from Dida back to SiYuan, and updating Dida titles when the SiYuan todo text changes.

The first version does not delete tasks on either side, does not sync reminders, due dates, repeating tasks, subtasks, tables, database blocks, or Dida title edits back to SiYuan.

## CLI Strategy

The plugin calls the local `dida` command through Node's `child_process` on desktop. The command is not hardcoded.

Resolution order:

1. Use the configured command if present; default is `dida`.
2. Run `<command> --version`.
3. If that fails and the configured command does not contain a path separator, run shell discovery commands such as `/bin/zsh -lc 'command -v dida'`, `/bin/bash -lc 'command -v dida'`, and `command -v dida`.
4. Cache the discovered executable path in local plugin settings while still allowing per-device override.

This keeps synced task metadata portable while letting each desktop device resolve its own CLI path.

## Architecture

- `DidaCliClient`: wraps `dida project list`, `dida task create`, `dida task update`, `dida task complete`, and `dida task completed`.
- `TodoParser`: parses Markdown task block text into title, completion state, and a rewritten completed form.
- `SiYuanRepository`: talks to SiYuan kernel APIs for SQL queries, block attributes, and block updates.
- `SyncEngine`: owns one sync run. It scans configured ranges, creates missing Dida tasks, updates changed titles, completes Dida tasks when SiYuan is completed, and writes SiYuan completion when Dida is completed.
- `SettingsStore`: persists plugin settings, sync logs, and per-device CLI discovery.
- `Plugin entry`: registers top-bar manual sync, settings UI, commands, and polling cleanup.

## Data Model

Synced tasks are bound through SiYuan block attributes:

```json
{
  "custom-dida-task-id": "dida task id",
  "custom-dida-project-id": "dida project id",
  "custom-dida-last-sync": "ISO timestamp",
  "custom-dida-last-hash": "hash of title and completion state",
  "custom-dida-sync-state": "synced"
}
```

Sync settings are plugin data, not note content:

```json
{
  "cliCommand": "dida",
  "resolvedCliPath": "",
  "autoSync": false,
  "syncIntervalSeconds": 15,
  "syncOnStartup": false,
  "maxTasksPerRun": 200,
  "ranges": [
    {
      "id": "work",
      "name": "工作",
      "notebookId": "20240320224209-5k3ke39",
      "hpathPrefix": "/工作日志",
      "includeChildren": true,
      "targetProjectId": "",
      "targetProjectName": "工作"
    }
  ]
}
```

## Sync Flow

1. Prevent overlapping runs with an in-memory lock.
2. Resolve and test the `dida` CLI.
3. For each configured range, query SiYuan list item blocks inside the notebook and human path.
4. Parse Markdown todo blocks. Ignore non-todos and unsynced completed historical todos.
5. For unsynced incomplete todos, create a Dida task and write binding attributes.
6. For synced todos, compare the current hash with the saved hash.
7. If SiYuan is completed, call `dida task complete <projectId> <taskId>`.
8. If the title changed and SiYuan is not completed, call `dida task update --title`.
9. Query Dida completed tasks for configured projects and mark matching SiYuan blocks completed when needed.
10. Save a compact log record with counts and failures.

## Error Handling

Failures are per task. A failed task increments the failed count, records the reason, and does not stop the sync run. Overlapping scheduled runs are skipped.

## UI

Use native-feeling SiYuan surfaces:

- Top bar button: manual sync.
- Command palette command: sync now.
- Settings panel: CLI command, test connection, auto sync controls, sync ranges, and recent logs.

The first implementation may use a compact settings HTML panel with native `b3-*` classes and text fields for notebook/path/project values. Visual pickers can follow later.

## Testing

Pure modules receive unit tests:

- Markdown todo parsing and completion rewriting.
- CLI command resolution and shell discovery fallback.
- Sync engine behavior with fake SiYuan and fake Dida clients.

Plugin UI is validated by TypeScript build in the first version.
