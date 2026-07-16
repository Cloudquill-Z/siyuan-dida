# Sync Status Tooltip Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the Dida sync status from SiYuan's bottom status bar to the existing top-bar sync button's hover tooltip.

**Architecture:** Keep the plugin's status string in the entry module and apply it to the HTMLElement returned by `Plugin.addTopBar`. A small exported helper updates the SiYuan tooltip attributes, allowing focused tests without constructing a full SiYuan plugin instance. Remove the former status-bar registration and CSS.

**Tech Stack:** TypeScript, SiYuan Plugin API, Vitest, Vite, Sass.

---

### Task 1: Cover top-bar tooltip status updates

**Files:**
- Create: `src/index.test.ts`
- Modify: `src/index.ts:13-31,146-150`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { setSyncTooltip } from "./index";

describe("setSyncTooltip", () => {
  test("writes the sync status to the top-bar hover attributes", () => {
    const button = document.createElement("button");

    setSyncTooltip(button, "滴答：12:34:56 已同步");

    expect(button.getAttribute("aria-label")).toBe("滴答：12:34:56 已同步");
    expect(button.getAttribute("data-tooltip")).toBe("滴答：12:34:56 已同步");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/index.test.ts`

Expected: FAIL because `setSyncTooltip` does not exist, or because the test environment lacks DOM support. If the latter occurs, configure Vitest with a DOM-compatible environment for this test before continuing.

**Step 3: Write minimal implementation**

```ts
export function setSyncTooltip(element: HTMLElement, text: string) {
  element.setAttribute("aria-label", text);
  element.setAttribute("data-tooltip", text);
}
```

Store the return value from `addTopBar`, initialize the tooltip with `滴答：待同步`, and call this helper from `updateStatus`. Remove the status-bar element and its `addStatusBar` call.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/index.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: show sync status on top bar hover"
```

### Task 2: Remove obsolete status-bar styling and release metadata

**Files:**
- Modify: `src/index.scss:9-13`
- Modify: `package.json:3`
- Modify: `plugin.json:5`

**Step 1: Remove obsolete CSS**

Delete the `.dida-sync-status` rule, since the plugin no longer creates a bottom status-bar element.

**Step 2: Update version metadata**

Set both `package.json` and `plugin.json` versions from `1.1.7` to `1.1.8`.

**Step 3: Validate metadata and styling through the full build**

Run: `npm run typecheck && npm run build`

Expected: both commands exit successfully, and `dist/index.css` no longer contains `.dida-sync-status`.

**Step 4: Commit**

```bash
git add src/index.scss package.json plugin.json package-lock.json
git commit -m "chore: release v1.1.8"
```

### Task 3: Verify, package, install, and publish

**Files:**
- Verify: `dist/index.js`
- Verify: `dist/index.css`
- Verify: `dist/plugin.json`
- Verify: `dist/README.md`
- Verify: `dist/README_zh_CN.md`
- Verify: `dist/icon.png`
- Verify: `dist/preview.png`
- Install: `/Users/lance/Documents/Siyuan/data/plugins/siyuan-dida/`

**Step 1: Run required checks**

Run: `npm test && npm run typecheck && npm run build`

Expected: all commands exit successfully.

**Step 2: Verify build contents**

Run: `for file in index.js index.css plugin.json README.md README_zh_CN.md icon.png preview.png; do test -f "dist/$file" || exit 1; done`

Expected: exits successfully.

**Step 3: Install the built plugin**

Run: `rm -rf /Users/lance/Documents/Siyuan/data/plugins/siyuan-dida && mkdir -p /Users/lance/Documents/Siyuan/data/plugins/siyuan-dida && cp -R dist/. /Users/lance/Documents/Siyuan/data/plugins/siyuan-dida/`

Expected: the local SiYuan plugin directory contains the freshly built package.

**Step 4: Commit planning documentation and push**

```bash
git add docs/plans/2026-07-16-sync-status-tooltip-implementation.md
git commit -m "docs: add sync status tooltip implementation plan"
git push origin HEAD
```
