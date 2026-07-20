# SiYuan Dida Sync

A desktop-only SiYuan plugin that syncs Markdown todo blocks with Dida (TickTick) through the local `dida` CLI.

## Before you start

This plugin runs a command on your own computer. It supports SiYuan Desktop on macOS, Windows, and Linux; it does not run on mobile, Docker, or browser installations. Your Dida account, CLI installation, and authorization stay on each device.

## Install and authorize the Dida CLI

1. Open the [official Dida CLI guide](https://help.dida365.com/articles/7464976698707017728) and install the CLI for your computer.
2. Follow that guide to sign in or authorize the CLI on this device.
3. In a terminal, verify that the command is available:

   ```sh
   dida --version
   ```

4. Install **Dida Sync** from the SiYuan Bazaar and enable it. If SiYuan cannot find the command, open the plugin settings and enter `dida` or the command's absolute path. On Windows this is usually a `dida.cmd` path.

Repeat these steps on every computer that uses the plugin. The plugin stores resolved executable paths per device, so one computer's path is not used by another.

## Configure your first sync

1. Open **Settings → Dida Sync** in SiYuan.
2. Choose **Test connection**, then **Refresh Dida lists**.
3. Under **Sync ranges**, choose a SiYuan notebook, document path, target Dida list, and whether child documents are included.
4. Choose the default date for newly created Dida tasks:
   - **Today (all-day)** creates new Dida tasks dated today. This is the default.
   - **No date** creates new Dida tasks without a date.
5. Save settings, then use the top-bar sync button to run the first sync.

## What syncs

- An unchecked SiYuan Markdown todo creates a Dida task in its configured target list.
- Editing the title of a bound, incomplete SiYuan todo updates its Dida title.
- Completing a bound SiYuan todo completes its Dida task.
- Completing a bound Dida task marks the matching SiYuan todo completed.
- Todo nesting is preserved when the parent todo is also bound.

## Automatic sync

Enable **Automatic sync** in plugin settings and select an interval of at least five seconds. Only one sync runs at a time; an overlapping trigger is skipped. The sync log records created, updated, completed, skipped, and failed items.

## Troubleshooting

- **Dida CLI is unavailable:** run `dida --version` in a terminal first. If it works there but not in SiYuan, enter the absolute executable path in settings and test again.
- **No Dida lists appear:** authorize the CLI again using the [official guide](https://help.dida365.com/articles/7464976698707017728), then refresh lists.
- **A task did not sync:** confirm that its notebook and path belong to a configured range, then review the plugin sync log.
- **Another computer does not work:** install and authorize the CLI separately on that computer. Do not copy CLI paths or authorization files between devices.

## Limits

This MVP does not delete tasks, sync due dates or reminders, sync repeating tasks, synchronize Dida title edits back to SiYuan, or synchronize tables and database blocks. The new-task date setting affects only tasks created after the setting is saved; it never changes dates on existing Dida tasks.

## Development

```sh
npm test
npm run typecheck
npm run build
npm run package
```

`npm run package` creates `package.zip` for a GitHub Release.
