<h1 align="center">
    Jinja Language Server
    <br />
    <img src="https://img.shields.io/badge/license-MIT-blue.svg">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
    <br />
</h1>

<p align="center">
    <b>Blazingly fast Jinja language server.</b>
</p>

> [!WARNING]
> Jinja Language Server is currently in early development.

## Acknowledgements

- The [language](./packages/language/) package is based on [@huggingface/jinja](https://github.com/huggingface/huggingface.js/tree/main/packages/jinja), licensed under MIT by Hugging Face.
- The client is heavily based on [jinjahtml-vscode](https://github.com/samuelcolvin/jinjahtml-vscode), licensed under MIT by Samuel Colvin and other Contributors. In particular, the awesome syntaxes and the language configuration are included with only a few modifications!
- Some of the Jinja documentation is also provided, and some of the Python documentation as well

## Roadmap

- [x] Provide diagnostics
- [x] Provide semantic highlighting
- [x] Make lexer and parser more error tolerant
- [x] Provide hover
- [x] Provide go to definition
- [x] Provide signature help
- [x] Resolve imports
- [x] Provide definitions from imports
- [x] Track types of expressions
- [ ] Provide auto-complete
  - [x] for member expressions
- [ ] Support custom import directories
- [ ] Provide format document
- [ ] Provide document symbols
- [ ] Provide documentation for user-defined symbols
- [ ] Provide an API for other extensions to add globals
- [ ] Support embedded code languages in Markdown (hover, signature help, semantic highlighting, diagnostics)
- [ ] Make lexer/parser more performant (incremental)
- [ ] Support custom start/end symbols (instead of `{{, {%, {#`)
- [ ] Rewrite in rust
