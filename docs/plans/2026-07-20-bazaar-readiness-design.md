# Bazaar Readiness Design

## Goal

Make Siyuan Dida Sync ready for a first SiYuan Bazaar listing while preserving its desktop-only, local-CLI design.

## Scope

- Replace non-standard `zh_CN` marketplace metadata keys with BCP 47 `zh-CN` keys and use a matching Chinese README filename.
- Add English and Simplified Chinese UI text resources. All settings-panel text, commands, notices, sync events, and Dida task source text must use those resources.
- Add a creation-date preference for newly created Dida tasks. The supported values are `today` (the default) and `none`.
- Keep the existing behaviour for current users: settings without the new preference normalize to `today`.
- Rewrite both README files with a complete user flow: the official Dida CLI installation guide, per-device authorization, command verification, SiYuan setup, manual and automatic sync, limitations, and troubleshooting.
- Optimize the marketplace artwork and create a repeatable `package.zip` release artifact.

## Data and Sync Behaviour

`PluginSettings` and `SyncSettings` gain a `newTaskDate` value of `"today" | "none"`. When a newly discovered SiYuan todo is created in Dida:

- `today`: pass an all-day local calendar date to the Dida CLI, as the plugin does today.
- `none`: omit both date-related arguments, leaving the Dida task undated.

The setting affects only tasks that are newly created during a sync. Existing bindings continue to synchronize title and completion exactly as before; no existing Dida dates are modified.

## Internationalization

Use SiYuan plugin i18n resources for English and Simplified Chinese. The plugin entry obtains the selected language from `this.i18` and passes a translation function into the settings panel and sync engine. Translation templates support the small dynamic values already shown to users, such as CLI version, range name, and error message.

Marketplace metadata uses `default` for English and `zh-CN` for Simplified Chinese. The Chinese README is renamed to `README.zh-CN.md` and the build copies it into the release directory.

## Release Assets and Documentation

The icon remains 160 by 160 pixels but is losslessly or visually optimized to the marketplace size guidance. The preview is replaced with a 1024 by 768 image and compressed below the recommended size threshold.

The package script builds `dist/`, verifies required files, and archives only the package contents as `package.zip`. Release documentation links to the official Dida CLI guide supplied by the user rather than reproducing platform-specific third-party installation commands.

## Validation

Tests cover defaulting and persistence of `newTaskDate`, creation with and without date arguments, and localized resource lookup. The final release workflow runs tests, type checking, build, package-content checks, local SiYuan installation, Git commit and push, GitHub Release upload, and the first Bazaar index pull request.
