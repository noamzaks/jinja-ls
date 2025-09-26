import { ast, LexerError, parse, tokenize } from "@jinja-lsp/language"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { createConnection } from "vscode-languageserver/node"
import { filters, globals, tests } from "./generated"
import { getTokens, legend } from "./semantic"
import { argToPython, getSymbols, SymbolInfo } from "./symbols"
import { tokenAt } from "./utilities"

const connection = createConnection(lsp.ProposedFeatures.all)
const documents = new lsp.TextDocuments(TextDocument)
const documentASTs: Map<
  string,
  {
    program?: ast.Program
    lexerErrors?: LexerError[]
    parserErrors?: ast.ErrorNode[]
  }
> = new Map()
const documentSymbols: Map<string, Map<string, SymbolInfo>> = new Map()

connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
      semanticTokensProvider: {
        legend,
        documentSelector: [
          { scheme: "file", language: "jinja" },
          { scheme: "file", language: "jinja-md" },
        ],
        full: true,
      },
      hoverProvider: true,
      definitionProvider: true,
    },
  } satisfies lsp.InitializeResult
})

documents.onDidChangeContent((event) => {
  const document = event.document
  const ast = getDocumentAST(document.getText())
  documentASTs.set(document.uri, ast)
  if (ast.program) {
    const symbols = getSymbols(ast.program)
    documentSymbols.set(document.uri, symbols)
  }
})

const getDocumentAST = (contents: string) => {
  try {
    const [tokens, lexerErrors] = tokenize(contents, {}, true)
    const [program, parserErrors] = parse(tokens, true)
    return { program, lexerErrors, parserErrors }
  } catch (e) {
    console.log(e)
  }
  return {}
}

connection.languages.diagnostics.on(async (params) => {
  const ast = documentASTs.get(params.textDocument.uri)

  const items: lsp.Diagnostic[] = []
  const document = documents.get(params.textDocument.uri)
  if (document !== undefined) {
    for (const e of ast?.parserErrors ?? []) {
      if (e.type === "MissingNode") {
        const missingNode = e as ast.MissingNode
        const position = document.positionAt(missingNode.before.start)
        items.push({
          message: `Expected ${missingNode.missingType}`,
          range: lsp.Range.create(position, position),
          severity: lsp.DiagnosticSeverity.Error,
        })
      } else if (e.type === "UnexpectedToken") {
        const UnexpectedToken = e as ast.UnexpectedToken
        items.push({
          message: `Unexpected ${UnexpectedToken.message}`,
          range: lsp.Range.create(
            document.positionAt(UnexpectedToken.token.start),
            document.positionAt(UnexpectedToken.token.end)
          ),
          severity: lsp.DiagnosticSeverity.Error,
        })
      }
    }

    for (const e of ast?.lexerErrors ?? []) {
      items.push({
        message: e.message,
        range: lsp.Range.create(
          document.positionAt(e.start),
          document.positionAt(e.end)
        ),
        severity: lsp.DiagnosticSeverity.Error,
      })
    }
  }

  return {
    kind: lsp.DocumentDiagnosticReportKind.Full,
    items,
  } satisfies lsp.DocumentDiagnosticReport
})

connection.languages.semanticTokens.on(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const builder = new lsp.SemanticTokensBuilder()
  const program = documentASTs.get(params.textDocument.uri)?.program

  if (document !== undefined && program !== undefined) {
    const items = getTokens([program])
    for (const item of items) {
      const position = document.positionAt(item.start)
      builder.push(
        position.line,
        position.character,
        item.end - item.start,
        item.tokenType,
        item.tokenModifiers
      )
    }
  }

  const result = builder.build()
  return result
})

connection.onHover(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const program = documentASTs.get(params.textDocument.uri)?.program
  const symbols = documentSymbols.get(params.textDocument.uri)

  if (program !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(program, offset)
    if (!token) {
      return
    }

    // Builtin Filter
    if (
      filters[token.value] &&
      token.parent?.type === "Identifier" &&
      ((token.parent?.parent?.type === "CallExpression" &&
        token.parent?.parent?.parent?.type === "FilterExpression") ||
        token.parent?.parent?.type === "FilterExpression")
    ) {
      return {
        contents: [
          {
            language: "python",
            value: `(filter) def ${token.value}(${filters[
              token.value
            ].parameters
              .map((p) => (p.default ? `${p.name}=${p.default}` : p.name))
              .join(", ")})`,
          },
          filters[token.value].brief,
        ],
      } satisfies lsp.Hover
    }

    // Builtin Test
    if (
      tests[token.value] &&
      token.parent?.type === "Identifier" &&
      token.parent.parent?.type === "TestExpression" &&
      (token.parent.parent as ast.TestExpression).test === token.parent
    ) {
      return {
        contents: [
          {
            language: "python",
            value: `(test) def ${token.value}(${tests[token.value].parameters
              .map((p) => (p.default ? `${p.name}=${p.default}` : p.name))
              .join(", ")})`,
          },
          tests[token.value].brief,
        ],
      } satisfies lsp.Hover
    }

    // Function
    if (
      token.parent?.type === "Identifier" &&
      token.parent.parent?.type === "CallExpression" &&
      (token.parent.parent as ast.CallExpression).callee === token.parent
    ) {
      // Global Function
      if (globals[token.value]) {
        return {
          contents: [
            {
              language: "python",
              value: `(global) def ${token.value}(${globals[
                token.value
              ].parameters
                .map((p) => (p.default ? `${p.name}=${p.default}` : p.name))
                .join(", ")})`,
            },
            globals[token.value].brief,
          ],
        } satisfies lsp.Hover
      }

      const symbol = symbols?.get(token.value)
      if (symbol !== undefined) {
        const macroNode = symbol.token.parent!.parent! as ast.Macro
        return {
          contents: [
            {
              language: "python",
              value:
                macroNode.args.length === 0
                  ? `(macro) def ${token.value}()`
                  : `(macro) def ${token.value}(\n\t${macroNode.args
                      .map((arg) => argToPython(arg, document))
                      .filter((x) => x !== undefined)
                      .join(", \n\t")}\n)`,
            },
          ],
        } satisfies lsp.Hover
      }
    }
  }
})

connection.onDefinition(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const program = documentASTs.get(params.textDocument.uri)?.program
  const symbols = documentSymbols.get(params.textDocument.uri)

  if (program !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(program, offset)
    if (!token) {
      return
    }

    if (
      token.parent?.type === "Identifier" &&
      token.parent.parent?.type === "CallExpression" &&
      (token.parent.parent as ast.CallExpression).callee === token.parent
    ) {
      const symbol = symbols?.get(token.value)
      if (!symbol) {
        return
      }

      return lsp.Location.create(
        params.textDocument.uri,
        lsp.Range.create(
          document.positionAt(symbol.token.start),
          document.positionAt(symbol.token.end)
        )
      )
    }
  }
})

documents.listen(connection)
connection.listen()
