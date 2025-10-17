import { ast, parse, tokenize } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { createConnection } from "vscode-languageserver/node"
import { URI } from "vscode-uri"
import { getCompletion } from "./completion"
import { readFile, registerCustomCommands } from "./customRequests"
import { getDefinition } from "./definition"
import { getDiagnostics } from "./diagnostics"
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
        ],
        full: true,
      },
      hoverProvider: true,
      definitionProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ["(", ",", "="],
      },
      completionProvider: {
        triggerCharacters: [".", " "],
      },
    },
  } satisfies lsp.InitializeResult
})

const analyzeDocument = async (document: TextDocument) => {
  documents.set(document.uri, document)
  const ast = getDocumentAST(document.getText())
  documentASTs.set(document.uri, ast)
  const symbols = new Map<string, SymbolInfo[]>()
  const imports: (ast.Include | ast.Import | ast.FromImport | ast.Extends)[] =
    []
  const lsCommands: string[] = []

  if (ast.program) {
    walk(ast.program, (statement) => {
      collectSymbols(statement, symbols, imports, lsCommands)
    })

    documentSymbols.set(document.uri, symbols)

    const documentsToAnalyze: [string, string][] = []
    const resolvedImports: [
      ast.Include | ast.Import | ast.FromImport | ast.Extends,
      string,
    ][] = []
    for (const i of imports) {
      const [uri, contents] = await findImport(i, document.uri, (uri) =>
        readFile(connection, uri),
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
    connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: getDiagnostics(document.uri).items,
    })
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
  getSemanticTokens(params.textDocument.uri),
)

connection.onHover(async (params) =>
  getHover(params.textDocument.uri, params.position),
)

connection.onDefinition(async (params) =>
  getDefinition(params.textDocument.uri, params.position),
)

connection.onSignatureHelp(async (params) =>
  getSignatureHelp(params.textDocument.uri, params.position),
)

connection.onCompletion(async (params) =>
  getCompletion(
    params.textDocument.uri,
    params.position,
    params.context.triggerCharacter,
  ),
)

registerCustomCommands(connection)
lspDocuments.listen(connection)
connection.listen()
