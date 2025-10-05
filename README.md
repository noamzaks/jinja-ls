<h1 align="center">
    Jinja Language Server
    <br />
    <img src="https://img.shields.io/badge/license-MIT-blue.svg">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
    <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/noamzaks/jinja-ls/check.yml">
    <img alt="Visual Studio Marketplace Version" src="https://img.shields.io/visual-studio-marketplace/v/noamzaks.jinja-ls">
    <br />
</h1>

<p align="center">
    <b>Feature-rich language server for Jinja.</b>
</p>

Jinja Language Server is in early development, please report bugs on GitHub!

## Features

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
- [x] Provide an API for other extensions to add globals
- [x] Support custom import directories
- [ ] Provide format document
- [ ] Provide document symbols
- [ ] Provide documentation for user-defined symbols
- [ ] Support embedded code languages in Markdown (hover, signature help, semantic highlighting, diagnostics)
- [ ] Make lexer/parser more performant (incremental)
- [ ] Support custom start/end symbols (instead of `{{, {%, {#`)
- [ ] Rewrite in rust

## Demo

Errors are shown using the awesome [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) extension!

![autocomplete filters demo](./images/demo-autocomplete-filter.png)
![autocomplete globals demo](./images/demo-autocomplete-globals.png)
![autocomplete str demo](./images/demo-autocomplete-str.png)
![autocomplete tests demo](./images/demo-autocomplete-test.png)
![autocomplete diagnostics demo](./images/demo-diagnostics.png)
![include analysis demo](./images/demo-include.png)
![macro signature demo](./images/demo-macro-signature.png)

## Usage

### Import Paths

In VSCode settings you may add directories to "Jinjs LS: Import Paths" to be searched in include/import/from import/extends statements.

### Custom Globals

You can add globals from your extension with the `jinja-ls.addGlobals` command, for example:

```ts
vscode.commands.executeCommand("jinja-ls.setGlobals", {
  hi: "hello",
  other: 1574,
  test: 1.2,
  deep: { object: [1, 2] },
})
```

This merges the existing globals set by previous calls to `jinja-ls.addGlobals`, if you wish to remove them set the second parameter `merge` to false:

```ts
vscode.commands.executeCommand(
  "jinja-ls.setGlobals",
  {
    hi: "hello",
  },
  false,
)
```

## Acknowledgements

- The [language](./packages/language/) package is based on [@huggingface/jinja](https://github.com/huggingface/huggingface.js/tree/main/packages/jinja), licensed under MIT by Hugging Face.
- Basic functionality and language associations are provided by the awesome [jinjahtml-vscode](https://github.com/samuelcolvin/jinjahtml-vscode) extension!
- The overall layout as well as many code samples are taken from Microsoft's [lsp-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-sample) licensed under MIT.
- Some of the Jinja documentation is also provided (licensed under MIT), and some of the Python documentation as well (licensed under zero-clause BSD)
- Special thank you to Omri for the original idea.
