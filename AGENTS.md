# Agent Rules

These rules apply to the whole repository.

## Required Workflow After User-Requested Changes

Whenever the user asks an Agent to modify this project, after the requested change is implemented:

1. Update the project version.
   - The current baseline version is `1.0.0`.
   - Keep `package.json` and `plugin.json` in sync.
   - Use semantic versioning. If the user does not specify the bump type, increment the patch version for normal fixes and small feature changes.
2. Verify the plugin before reporting completion.
   - Run `npm test`.
   - Run `npm run typecheck`.
   - Run `npm run build`.
   - Confirm `dist/` contains the plugin package files required by SiYuan, including `index.js`, `index.css`, `plugin.json`, readme files, `icon.png`, and `preview.png`.
3. Install the built plugin to the local SiYuan desktop data directory.
   - Target path: `/Users/lance/Documents/Siyuan/data/plugins/siyuan-dida`.
   - Replace the installed plugin with the freshly built `dist/` contents.
4. Commit and push the completed change to GitHub.
   - Commit all relevant source, metadata, tests, documentation, and asset changes.
   - Push to the configured `origin` remote.
   - If commit or push fails, report the exact command and reason.

## Safety

- Do not commit local secrets, tokens, `.env` files, logs, or SiYuan runtime data.
- Do not revert user changes unless the user explicitly asks for that.
- Keep changes scoped to the user's request and the required version/build/install workflow above.
