import { ast, parse, tokenize } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { createConnection } from "vscode-languageserver/node"
import { URI } from "vscode-uri"
import { getCodeAction } from "./codeAction"
import { getCompletion } from "./completion"
import { readUri, registerCustomCommands } from "./customRequests"
import { getDefinition } from "./definition"
import { getDiagnostics } from "./diagnostics"
import { getDocumentLinks } from "./documentLinks"
import { getHover } from "./hover"
import { processLSCommand } from "./lsCommands"
import { getSemanticTokens, legend } from "./semantic"
import { getSignatureHelp } from "./signatureHelp"
import {
  configuration,
  documentASTs,
  documentImports,
  documents,
  documentSymbols,
  rootURIs,
} from "./state"
import { collectSymbols, findImport, SymbolInfo } from "./symbols"
import { walk } from "./utilities"

const connection = createConnection(lsp.ProposedFeatures.all)
const lspDocuments = new lsp.TextDocuments(TextDocument)

const getDocumentAST = (contents: string) => {
  try {
    const [tokens, lexerErrors] = tokenize(contents, {}, true)
    const [program, tokenNodes, parserErrors] = parse(tokens, true)
    return { program, lexerErrors, parserErrors, tokens: tokenNodes }
  } catch (e) {
    console.log(e)
  }
  return {}
}

export const protectOnThrow = <T>(fn: () => T) => {
  try {
    return fn()
  } catch (e) {
    console.log(e)
  }
}

connection.onInitialize((params) => {
  for (const folder of params.workspaceFolders ?? []) {
    rootURIs.push(URI.parse(folder.uri))
  }

  return {
    capabilities: {
      textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
      semanticTokensProvider: {
        legend,
        documentSelector: [
          { scheme: "file", language: "jinja" },
          { scheme: "file", language: "jinja-html" },
          { scheme: "file", language: "jinja-xml" },
          { scheme: "file", language: "jinja-css" },
          { scheme: "file", language: "jinja-json" },
          { scheme: "file", language: "jinja-md" },
          { scheme: "file", language: "jinja-yaml" },
          { scheme: "file", language: "jinja-toml" },
          { scheme: "file", language: "jinja-lua" },
          { scheme: "file", language: "jinja-properties" },
          { scheme: "file", language: "jinja-shell" },
          { scheme: "file", language: "jinja-dockerfile" },
          { scheme: "file", language: "jinja-sql" },
          { scheme: "file", language: "jinja-py" },
          { scheme: "file", language: "jinja-cy" },
          { scheme: "file", language: "jinja-terraform" },
          { scheme: "file", language: "jinja-nginx" },
          { scheme: "file", language: "jinja-groovy" },
          { scheme: "file", language: "jinja-systemd" },
          { scheme: "file", language: "jinja-cpp" },
          { scheme: "file", language: "jinja-java" },
          { scheme: "file", language: "jinja-js" },
          { scheme: "file", language: "jinja-ts" },
          { scheme: "file", language: "jinja-php" },
          { scheme: "file", language: "jinja-cisco" },
          { scheme: "file", language: "jinja-rust" },
          { scheme: "file", language: "jinja-typst" },
        ],
        full: true,
      },
      hoverProvider: true,
      definitionProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ["(", ",", "="],
        retriggerCharacters: [")"],
      },
      completionProvider: {
        triggerCharacters: [".", " ", '"', "/"],
      },
      codeActionProvider: true,
      documentLinkProvider: {
        resolveProvider: false,
      },
    },
  } satisfies lsp.InitializeResult
})

const analyzeDocument = async (document: TextDocument) => {
  documents.set(document.uri, document)
  const ast = getDocumentAST(document.getText())
  const symbols = new Map<string, SymbolInfo[]>()
  const imports: (ast.Include | ast.Import | ast.FromImport | ast.Extends)[] =
    []
  const lsCommands: string[] = []

  if (ast.program) {
    walk(ast.program, (statement) => {
      collectSymbols(statement, symbols, imports, lsCommands)
    })

    // Update initial analysis before going async
    documentASTs.set(document.uri, ast)
    documentSymbols.set(document.uri, symbols)
    const previousImports = documentImports.get(document.uri) ?? []
    documentImports.set(
      document.uri,
      imports.map((i) => [
        i,
        (previousImports.find(
          (x) =>
            (x[0].source as ast.StringLiteral | undefined)?.value ===
            (i.source as ast.StringLiteral | undefined)?.value,
        ) ?? [])[1],
      ]),
    )

    const documentsToAnalyze: [string, string][] = []
    const resolvedImports: [
      ast.Include | ast.Import | ast.FromImport | ast.Extends,
      string,
    ][] = []
    for (const i of imports) {
      const [uri, contents] = await findImport(i, document.uri, (uri) =>
        readUri(connection, uri),
      )
      documentsToAnalyze.push([uri, contents])
      resolvedImports.push([i, uri])
    }

    documentImports.set(document.uri, resolvedImports)

    const promises: Promise<void>[] = []
    for (const [uri, contents] of documentsToAnalyze) {
      if (contents !== documents.get(uri)?.getText()) {
        promises.push(
          analyzeDocument(
            TextDocument.create(
              uri,
              document.languageId,
              document.version,
              contents,
            ),
          ),
        )
      }
    }

    for (const command of lsCommands) {
      await processLSCommand(connection, document, command)
    }

    await Promise.all(promises)
    const diagnostics = protectOnThrow(() => getDiagnostics(document.uri).items)
    if (diagnostics !== undefined) {
      connection.sendDiagnostics({
        uri: document.uri,
        diagnostics,
      })
    }
  }
}

lspDocuments.onDidChangeContent((event) => {
  analyzeDocument(event.document)

  if (!configuration.initialized) {
    connection.workspace
      .getConfiguration({
        section: "jinjaLS",
      })
      .then((currentConfiguration) => {
        for (const key in currentConfiguration) {
          configuration[key] = currentConfiguration[key]
        }
        configuration.initialized = true
        analyzeDocument(event.document)
      })
  }
})

connection.languages.semanticTokens.on(async (params) =>
  protectOnThrow(() => getSemanticTokens(params.textDocument.uri)),
)

connection.onHover(async (params) =>
  protectOnThrow(() => getHover(params.textDocument.uri, params.position)),
)

connection.onDefinition(async (params) =>
  protectOnThrow(() => getDefinition(params.textDocument.uri, params.position)),
)

connection.onSignatureHelp(async (params) =>
  protectOnThrow(() =>
    getSignatureHelp(params.textDocument.uri, params.position),
  ),
)

connection.onCompletion(
  async (params) =>
    await protectOnThrow(() =>
      getCompletion(
        connection,
        params.textDocument.uri,
        params.position,
        params.context.triggerCharacter,
      ),
    ),
)

connection.onCodeAction(async (params) =>
  protectOnThrow(() =>
    getCodeAction(params.textDocument.uri, params.context.diagnostics),
  ),
)

connection.onDocumentLinks(async (params) =>
  protectOnThrow(() => getDocumentLinks(params.textDocument.uri)),
)

registerCustomCommands(connection)
lspDocuments.listen(connection)
connection.listen()
