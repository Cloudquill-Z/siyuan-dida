# License File Design

## Goal

Add the missing repository-level license file while preserving the package's existing MIT license declaration.

## Design

Add a standard `LICENSE` file containing the MIT License text, with copyright attribution `Copyright (c) 2026 lance`. Keep `package.json`'s `"license": "MIT"` unchanged. Bump the plugin patch version from `1.1.9` to `1.1.10` in both release manifests, then validate, install, commit, push, and publish the release package.
