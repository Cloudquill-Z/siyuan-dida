# SiYuan Dida Sync

Desktop-only SiYuan plugin for syncing Markdown todo blocks with Dida through the local `dida` CLI.

This project is in early MVP development.

## Sync Strategy

- Each configured SiYuan range is processed in batches of candidate todo blocks. The default batch size is 200.
- The plugin stores a cursor for each range. After one batch is processed, the next sync continues from later candidates; when it reaches the end, it wraps back to the beginning.
- When the cursor is not at the beginning, each run still reserves a small priority window for the newest candidates so recently edited titles can sync quickly.
- Synced historical tasks whose content has not changed are skipped instead of repeatedly calling Dida completion APIs.
- If a synced incomplete SiYuan todo title changes, the matching Dida task title is updated on sync.
