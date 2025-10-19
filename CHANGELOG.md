# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.8] - 2025-10-19

### Added

- Typing for the cycler builtin is now available.
- Typing for the ternary expression, the select expression and the slice expression is now available.
- Symbols from call statements and block set statements are now available.

## [0.0.7] - 2025-10-18

### Added

- Code action to add missing nodes.
- You can now add custom tests and filters in the configuration.
- Lists, dicts and tuples now have richer type information.
- You can add documentation to macros and variables.

### Changed

- The extension now contains modified code instead of depending on jinjahtml-vscode.
- Imports are now searched in the workspace root(s) as well.
- The importPaths configuration has been renamed to importURIs.

### Fixed

- Built-in types (mostly from Python) are now more accurate.
- Symbol resolution is now correctly according to the definition order.
- Signature help is now shown only inside the function call itself.

## [0.0.6] - 2025-10-06

### Added

- You can now add globals from JSON/TOML/YAML files using LS commands, e.g. `{#- jinja-ls: globals ./example.json -#}`

## [0.0.5] - 2025-10-06

### Added

- Types are now resolved for unary, binary, test and filter expressions.
- Completion now supports block names as well.
- Tests and filters now support signature info, arguments are more accurate.

## [0.0.4] - 2025-10-05

### Added

- Additional import paths can now be added in the extension's configuration.

## [0.0.3] - 2025-10-05

### Added

- Globals can now be set with the `jinja-ls.addGlobals` command.
- Type inference for iteration of arrays and tuples is now supported.

### Changed

- The extension now depends on jinjahtml-vscode for language definitions.

### Fixed

- Show hover information for tuple items.

## [0.0.2] - 2025-10-04

### Added

- Tests using call expressions like `ge(3)` are now parsed and show hover information.

### Fixed

- Completion for filters and tests now works when the filter/test identifier name is missing.
- The scoping of macro arguments is now fixed to prevent them from auto-completing themselves.

## [0.0.1] - 2025-10-02

### Added

- Error tolerant lexer & parser.
- Hover for variables and macros.
- Go to definition for blocks, macros and variables.
- Signature help for macros and globals.
- Relative import resolving.
- Type tracking for variables.
- Autocomplete for built-in tests, built-in filters and variables
