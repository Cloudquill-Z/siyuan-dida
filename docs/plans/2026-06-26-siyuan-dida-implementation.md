# SiYuan Dida Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a SiYuan desktop plugin that syncs configured Markdown todo blocks with Dida through the local `dida` CLI.

**Architecture:** Use a small TypeScript/Vite plugin with pure tested modules for parsing, CLI execution, and sync decisions. The SiYuan plugin entry wires those modules into top-bar sync, settings, storage, and polling.

**Tech Stack:** TypeScript, Vite, Vitest, SiYuan plugin API, Node `child_process`, Dida CLI JSON output.

---

### Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `plugin.json`
- Create: `README.md`
- Create: `README_zh_CN.md`
- Create: `src/index.ts`
- Create: `src/index.scss`

**Steps:**
1. Create a Vite library build that emits `index.js` and `index.css`.
2. Configure `plugin.json` for desktop frontends and desktop backends.
3. Add scripts: `test`, `build`, `typecheck`.
4. Verify `pnpm install` and `pnpm run build`.

### Task 2: Todo Parsing

**Files:**
- Create: `src/core/todoParser.ts`
- Create: `src/core/todoParser.test.ts`

**Steps:**
1. Write failing tests for unchecked `- [ ]`, checked `* [X]`, non-task text, and completion rewriting.
2. Run `pnpm test src/core/todoParser.test.ts`.
3. Implement parser and rewriter.
4. Re-run tests.

### Task 3: CLI Discovery And Client

**Files:**
- Create: `src/dida/cli.ts`
- Create: `src/dida/cli.test.ts`

**Steps:**
1. Write failing tests for direct command success, shell fallback, and command failure.
2. Implement CLI executor with injectable runner.
3. Add methods for project list, task create, task update title, task complete, completed tasks, and test connection.
4. Re-run tests.

### Task 4: Sync Engine

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/hash.ts`
- Create: `src/core/syncEngine.ts`
- Create: `src/core/syncEngine.test.ts`

**Steps:**
1. Write failing tests for creating unsynced incomplete tasks, ignoring unsynced completed historical tasks, completing Dida from SiYuan, and completing SiYuan from Dida.
2. Implement repository/client interfaces and sync orchestration.
3. Re-run tests.

### Task 5: SiYuan Repository

**Files:**
- Create: `src/siyuan/api.ts`
- Create: `src/siyuan/repository.ts`

**Steps:**
1. Implement kernel API helper for `/api/query/sql`, `/api/attr/setBlockAttrs`, and `/api/block/updateBlock`.
2. Implement range scanning with SQL filtering by `box`, `hpath`, and markdown task markers.
3. Keep title and completion parsing in `TodoParser`.

### Task 6: Settings And Plugin Wiring

**Files:**
- Modify: `src/index.ts`
- Create: `src/settings/defaults.ts`
- Create: `src/settings/settingsPanel.ts`

**Steps:**
1. Load settings with defaults in `onload()`.
2. Register top bar button and command for manual sync.
3. Add settings panel with CLI command, connection test, auto sync, interval, max tasks, ranges JSON, and recent logs.
4. Add interval management and cleanup in `onunload()`.

### Task 7: Verification

**Files:**
- All changed files.

**Steps:**
1. Run `pnpm test`.
2. Run `pnpm run typecheck`.
3. Run `pnpm run build`.
4. Confirm `index.js`, `index.css`, and manifest files exist.

Note: this workspace is not currently a git repository, so commit steps are intentionally skipped.
