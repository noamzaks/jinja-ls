import { ast, LexerError, parse, tokenize } from "@jinja-lsp/language"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { createConnection } from "vscode-languageserver/node"
import { filters, globals, tests } from "./generated"
import { getTokens, legend } from "./semantic"
import { tokenAt } from "./utilities"

const connection = createConnection(lsp.ProposedFeatures.all)
const documents = new lsp.TextDocuments(TextDocument)
const documentASTs: Map<
  string,
  {
    program?: ast.Program
    errors?: ast.ErrorNode[]
    error?: LexerError
  }
> = new Map()

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
    },
  } satisfies lsp.InitializeResult
})

documents.onDidChangeContent((event) => {
  const document = event.document
  const ast = getDocumentAST(document.getText())
  documentASTs.set(document.uri, ast)
})

const getDocumentAST = (contents: string) => {
  try {
    const tokens = tokenize(contents)
    const [program, errors] = parse(tokens, true)
    return { program, errors }
  } catch (e) {
    if (e instanceof LexerError) {
      return { error: e }
    }
  }
  return {}
}

connection.languages.diagnostics.on(async (params) => {
  const ast = documentASTs.get(params.textDocument.uri)
  const errors = ast?.errors
  const error = ast?.error
  const items: lsp.Diagnostic[] = []
  const document = documents.get(params.textDocument.uri)
  if (document !== undefined) {
    if (error) {
      items.push({
        message: error.message,
        range: lsp.Range.create(
          document.positionAt(error.start),
          document.positionAt(error.end)
        ),
        severity: lsp.DiagnosticSeverity.Error,
      })
    }
    for (const e of errors ?? []) {
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
            value: `def ${token.value}(${filters[token.value].parameters
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
            value: `def ${token.value}(${tests[token.value].parameters
              .map((p) => (p.default ? `${p.name}=${p.default}` : p.name))
              .join(", ")})`,
          },
          tests[token.value].brief,
        ],
      } satisfies lsp.Hover
    }

    // Global Function
    if (
      globals[token.value] &&
      token.parent?.type === "Identifier" &&
      token.parent.parent?.type === "CallExpression" &&
      (token.parent.parent as ast.CallExpression).callee === token.parent
    ) {
      return {
        contents: [
          {
            language: "python",
            value: `def ${token.value}(${globals[token.value].parameters
              .map((p) => (p.default ? `${p.name}=${p.default}` : p.name))
              .join(", ")})`,
          },
          globals[token.value].brief,
        ],
      } satisfies lsp.Hover
    }
  }
})

documents.listen(connection)
connection.listen()
