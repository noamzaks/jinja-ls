<h1 align="center">
    Jinja Language Server
    <br />
    <img src="https://img.shields.io/badge/license-MIT-blue.svg">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
    <br />
</h1>

<p align="center">
    <b>Feature-rich language server for Jinja.</b>
</p>

> [!WARNING]
> Jinja Language Server is currently in early development.

## Acknowledgements

- The [language](./packages/language/) package is based on [@huggingface/jinja](https://github.com/huggingface/huggingface.js/tree/main/packages/jinja), licensed under MIT by Hugging Face.
- The client is heavily based on [jinjahtml-vscode](https://github.com/samuelcolvin/jinjahtml-vscode), licensed under MIT by Samuel Colvin and other Contributors. In particular, the awesome syntaxes and the language configuration are included with only a few modifications!
- The overall layout as well as many code samples are taken from Microsoft's [lsp-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-sample) licensed under MIT.
- Some of the Jinja documentation is also provided (licensed under MIT), and some of the Python documentation as well (licensed under zero-clause BSD)
- Special thank you to Omri for the original idea.

## Roadmap

- [x] Provide diagnostics for lexing and parsing errors
- [x] Provide semantic highlighting
- [x] Make lexer and parser error tolerant
- [x] Provide hover for variables and macros
- [x] Provide go to definition for blocks, macros and variables
- [x] Provide signature help for macros and globals
- [x] Resolve imports
- [x] Provide symbols from imports
- [x] Track types of expressions including globals and special symbols
- [x] Provide auto-complete for built-in tests and filters and variables
- [ ] Support custom import directories
- [ ] Provide format document
- [ ] Provide document symbols
- [ ] Provide documentation for user-defined symbols
- [ ] Provide an API for other extensions to add globals
- [ ] Support embedded code languages in Markdown (hover, signature help, semantic highlighting, diagnostics)
- [ ] Make lexer/parser more performant (incremental)
- [ ] Support custom start/end symbols (instead of `{{, {%, {#`)
- [ ] Rewrite in rust
