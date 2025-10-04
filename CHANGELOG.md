# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
