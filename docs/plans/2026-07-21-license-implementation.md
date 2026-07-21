# License File Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a standard MIT license file and publish the resulting patch release.

**Architecture:** The root `LICENSE` becomes the canonical license text. Existing package metadata remains MIT and only receives the required patch-version update.

**Tech Stack:** Plain text, JSON, npm, Vite, Vitest, GitHub Releases.

---

### Task 1: Add the canonical MIT license

**Files:**
- Create: `LICENSE`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `plugin.json`

**Step 1:** Add the exact MIT License text with `Copyright (c) 2026 lance`.

**Step 2:** Bump both release manifests to `1.1.10`.

**Step 3:** Confirm the root license exists and the manifest versions agree.

### Task 2: Validate and publish

**Files:**
- Verify: `dist/`
- Verify: `package.zip`

**Step 1:** Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run package`.

**Step 2:** Confirm the built package contains required plugin files and install `dist/` into the local SiYuan plugin directory.

**Step 3:** Commit, push `main`, create GitHub Release `v1.1.10` with `package.zip`, and report the result.
