# Bazaar Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the plugin portable, localized, documented, packaged, and ready for its first SiYuan Bazaar listing.

**Architecture:** A small i18n module supplies translated strings to the plugin entry, settings panel, and sync engine. A `newTaskDate` setting is normalized with a compatibility default and controls the Dida create-task options. The build emits standardized marketplace metadata and a package archive.

**Tech Stack:** TypeScript, SiYuan Plugin API, Vite, Vitest, Sass, npm.

---

### Task 1: Add and verify the creation-date setting

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/settings/defaults.ts`
- Modify: `src/settings/defaults.test.ts`
- Modify: `src/core/syncEngine.ts`
- Modify: `src/core/syncEngine.test.ts`

**Step 1:** Write failing tests for the default `today` setting and for an undated task when `newTaskDate` is `none`.

**Step 2:** Run the focused tests and confirm they fail because the property and behaviour do not exist.

**Step 3:** Add the narrow `NewTaskDate` union, normalize legacy settings to `today`, pass it to the sync engine, and omit Dida date options for `none`.

**Step 4:** Run focused tests and the full test suite.

### Task 2: Localize plugin text and expose the setting

**Files:**
- Create: `src/i18n.ts`
- Create: `src/i18n.test.ts`
- Modify: `src/index.ts`
- Modify: `src/settings/settingsPanel.ts`
- Modify: `src/core/syncEngine.ts`

**Step 1:** Write a failing i18n test for English and Chinese lookup plus placeholder interpolation.

**Step 2:** Run it and confirm it fails because the i18n module is absent.

**Step 3:** Implement a small translation lookup, route visible user text through it, and render an English/Chinese select control for `newTaskDate`.

**Step 4:** Run focused and full tests, then typecheck.

### Task 3: Standardize marketplace metadata and release packaging

**Files:**
- Rename: `README_zh_CN.md` to `README.zh-CN.md`
- Modify: `plugin.json`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1:** Add a failing package-content test or verification command that requires the standardized Chinese README and `package.zip`.

**Step 2:** Run it and confirm the current package fails.

**Step 3:** Change locale keys to `zh-CN`, update copy rules, and add an npm package script that archives the built `dist` contents.

**Step 4:** Build, package, inspect the archive, and run typecheck/tests.

### Task 4: Rewrite user documentation and artwork

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `icon.png`
- Modify: `preview.png`
- Modify: `docs/plans/2026-07-16-sync-status-tooltip-implementation.md`

**Step 1:** Document the official Dida CLI guide, per-device auth, version verification, settings, date options, sync direction, limitations, and troubleshooting in both languages.

**Step 2:** Replace artwork with the marketplace-recommended dimensions and compressed files.

**Step 3:** Replace the developer-machine installation path in the historical implementation note with a portable placeholder.

**Step 4:** Build and inspect the final artifacts, dimensions, and file sizes.

### Task 5: Version, release validation, installation, and publication

**Files:**
- Modify: `package.json`
- Modify: `plugin.json`

**Step 1:** Bump both versions from `1.1.8` to `1.1.9`.

**Step 2:** Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run package`; inspect `dist` and `package.zip`.

**Step 3:** Replace the local SiYuan plugin installation with the newly built `dist` contents.

**Step 4:** Commit all source, metadata, docs, tests, and artwork changes; push `main`.

**Step 5:** Create GitHub Release `v1.1.9` with `package.zip`, then open the first Bazaar PR adding `Cloudquill-Z/siyuan-dida` to the plugin index.
