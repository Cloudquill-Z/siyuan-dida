# Sync Status Tooltip Design

## Goal

Move the Dida sync status from SiYuan's bottom status bar to the existing top-bar sync button, where it is visible only when the user hovers over the button.

## Interaction

- The plugin no longer registers a bottom status-bar element.
- The existing top-bar sync button remains in the same location and keeps the same click action.
- Before any sync has completed, its hover text is `滴答：待同步`.
- After a sync completes or fails, its hover text is updated with the existing timestamped status text, such as `滴答：12:34:56 已同步` or `滴答：12:34:56 同步失败`.
- Existing toast notifications and scheduled-sync behavior remain unchanged.

## Implementation

Keep a reference to the HTMLElement returned by the top-bar registration. Update that element's `aria-label` and `data-tooltip` attributes whenever the sync status changes, so SiYuan displays the status through its standard hover tooltip behavior. Remove the status-bar element, its registration, and its CSS rule.

## Verification

Add a focused test for the status tooltip attribute update, then run the full test suite, typecheck, and production build. Verify the built plugin contents before installing the fresh `dist/` package into the local SiYuan plugin directory.
