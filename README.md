<h1 align="center">
    Jinja LSP
    <br />
    <img src="https://img.shields.io/badge/license-MIT-blue.svg">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
    <br />
</h1>

<p align="center">
    <b>The greatest Jinja LSP ever made.</b>
</p>

> [!WARNING]
> Jinja LSP is currently in early development.

## Acknowledgements

- The [language](./packages/language/) package is based on [@huggingface/jinja](https://github.com/huggingface/huggingface.js/tree/main/packages/jinja), licensed under MIT by Hugging Face.
- The client is heavily based on [jinjahtml-vscode](https://github.com/samuelcolvin/jinjahtml-vscode), licensed under MIT by Samuel Colvin and other Contributors. In particular, the awesome syntaxes and the language configuration are included with only a few modifications!

## Roadmap

- [x] Provide diagnostics
- [x] Provide semantic highlighting
- [x] Make lexer and parser more error tolerant
- [ ] Provide hover
  - [x] for built-in tests/filters/global functions
  - [ ] for user-defined functions in scope
- [ ] Track types of
- [ ] Provide signature help
- [ ] Provide go to definition
- [ ] Provide document symbols
- [ ] Provide auto-complete
- [ ] Provide an API for other extensions to specify the globals
- [ ] Support embedded code languages in Markdown (hover, signature help, semantic highlighting, diagnostics)
- [ ] Make lexer/parser more performant (incremental)
- [ ] Rewrite in rust
