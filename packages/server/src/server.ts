import {
  ast,
  formatExpression,
  LexerError,
  parse,
  tokenize,
} from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { createConnection } from "vscode-languageserver/node"
import { URI, Utils } from "vscode-uri"
import { filters, globals, tests } from "./generated"
import { getTokens, legend } from "./semantic"
import {
  argToParameterInformation,
  collectSymbols,
  findSymbol,
  importToUri,
  macroToSignature,
  SymbolInfo,
} from "./symbols"
import { getType, resolveType } from "./types"
import { parentOfType, tokenAt, walk } from "./utilities"

const ReadFileRequest = new lsp.RequestType<
  { uri: string },
  { contents: string },
  void
>("jinja/readFile")

const connection = createConnection(lsp.ProposedFeatures.all)
const lspDocuments = new lsp.TextDocuments(TextDocument)
const documents = new Map<string, TextDocument>()
const documentASTs = new Map<
  string,
  {
    program?: ast.Program
    lexerErrors?: LexerError[]
    parserErrors?: ast.ErrorNode[]
  }
>()
const documentImports = new Map<
  string,
  (ast.Include | ast.Import | ast.FromImport | ast.Extends)[]
>()
const documentSymbols = new Map<string, Map<string, SymbolInfo[]>>()

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
      signatureHelpProvider: {
        triggerCharacters: ["(", ",", "="],
      },
    },
  } satisfies lsp.InitializeResult
})

const analyzeDocument = (document: TextDocument) => {
  documents.set(document.uri, document)
  const ast = getDocumentAST(document.getText())
  documentASTs.set(document.uri, ast)
  const symbols = new Map<string, SymbolInfo[]>()
  const imports: (ast.Include | ast.Import | ast.FromImport | ast.Extends)[] =
    []

  if (ast.program) {
    walk(ast.program, (statement) => {
      collectSymbols(statement, symbols, imports)
    })

    documentSymbols.set(document.uri, symbols)
    documentImports.set(document.uri, imports)

    for (const s of imports) {
      const importedUri = importToUri(s, document.uri)
      if (importedUri !== undefined) {
        connection
          .sendRequest(ReadFileRequest, { uri: importedUri })
          .then(({ contents }) => {
            if (
              contents &&
              contents !== documents.get(importedUri)?.getText()
            ) {
              analyzeDocument(
                TextDocument.create(
                  importedUri,
                  document.languageId,
                  document.version,
                  contents
                )
              )
            }
          })
      }
    }
  }
}

lspDocuments.onDidChangeContent((event) => {
  analyzeDocument(event.document)
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
        const unexpectedToken = e as ast.UnexpectedToken
        items.push({
          message: unexpectedToken.message,
          range: lsp.Range.create(
            document.positionAt(unexpectedToken.token.start),
            document.positionAt(unexpectedToken.token.end)
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
        token.parent?.parent?.type === "FilterExpression" ||
        token.parent?.parent?.type === "FilterStatement")
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

    const callExpression = parentOfType(token, "CallExpression") as
      | ast.CallExpression
      | undefined

    // Function
    if (
      token.parent?.type === "Identifier" &&
      callExpression !== undefined &&
      (callExpression.callee === token.parent ||
        (callExpression.callee.type === "MemberExpression" &&
          (callExpression.callee as ast.MemberExpression).property ===
            token.parent))
    ) {
      // Expression with known function type
      const callee = (callExpression as ast.CallExpression).callee
      const resolvedType = getType(
        callee,
        document,
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )
      if (resolvedType?.signature !== undefined) {
        const contents: lsp.MarkedString[] = [
          {
            language: "python",
            // TODO: arguments
            value: `() -> ${
              resolveType(resolvedType.signature.return)?.name ?? "None"
            }`,
          },
        ]
        if (resolvedType.signature.documentation) {
          contents.push(resolvedType.signature.documentation)
        }
        return {
          contents,
        } satisfies lsp.Hover
      }

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

      const [symbol, symbolDocument] = findSymbol(
        document,
        token,
        token.value,
        "Macro",
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )
      if (
        symbol !== undefined &&
        symbolDocument !== undefined &&
        symbol.token.openToken !== undefined &&
        symbol.token.closeToken !== undefined
      ) {
        return {
          contents: [
            {
              language: "jinja",
              value: symbolDocument.getText(
                lsp.Range.create(
                  symbolDocument.positionAt(symbol.token.openToken.start),
                  symbolDocument.positionAt(symbol.token.closeToken.end)
                )
              ),
            },
          ],
        } satisfies lsp.Hover
      }
    }

    // Block
    if (
      token.parent?.type === "Identifier" &&
      token.parent.parent?.type === "Block" &&
      (token.parent.parent as ast.Block).name === token.parent
    ) {
      const block = token.parent.parent as ast.Block
      const [blockSymbol, blockDocument] = findSymbol(
        document,
        block,
        block.name.value,
        "Block",
        documents,
        documentASTs,
        documentSymbols,
        documentImports,
        { checkCurrent: false, importTypes: ["Extends"] }
      )
      const sourceBlock = blockSymbol?.token as ast.Block | undefined
      if (
        blockSymbol !== undefined &&
        blockDocument !== undefined &&
        sourceBlock?.openToken !== undefined &&
        sourceBlock?.closeToken !== undefined
      ) {
        const sourceText = blockDocument.getText(
          lsp.Range.create(
            blockDocument.positionAt(sourceBlock.openToken.start),
            blockDocument.positionAt(sourceBlock.closeToken.end)
          )
        )

        return {
          contents: [
            {
              language: "jinja",
              value: sourceText,
            },
          ],
        } satisfies lsp.Hover
      }
    }

    if (token.parent?.type === "Identifier") {
      const identifier = token.parent as ast.Identifier
      const [symbol, symbolDocument] = findSymbol(
        document,
        identifier,
        identifier.value,
        "Variable",
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )

      if (
        symbol !== undefined &&
        symbolDocument !== undefined &&
        symbol.token.openToken !== undefined &&
        symbol.token.closeToken !== undefined &&
        symbol.token.assignee.type === "Identifier"
      ) {
        if (symbol.token.value) {
          const symbolType = getType(
            symbol.token?.value,
            document,
            documents,
            documentASTs,
            documentSymbols,
            documentImports
          )
          const typeString =
            symbolType !== undefined ? `: ${symbolType.name}` : ""
          return {
            contents: [
              {
                language: "python",
                value: `${identifier.value}${typeString} = ${formatExpression(
                  symbol.token.value
                )}`,
              },
            ],
          } satisfies lsp.Hover
        }
      }
    }
  }
})

connection.onDefinition(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const program = documentASTs.get(params.textDocument.uri)?.program
  const imports = documentImports.get(params.textDocument.uri)

  if (program !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(program, offset)
    if (!token) {
      return
    }

    const callExpression = parentOfType(token, "CallExpression") as
      | ast.CallExpression
      | undefined

    if (
      callExpression !== undefined &&
      callExpression.callee.type === "Identifier"
    ) {
      const name = (callExpression.callee as ast.Identifier).value
      const [symbol, symbolDocument] = findSymbol(
        document,
        callExpression,
        name,
        "Macro",
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )

      if (symbol !== undefined && symbolDocument !== undefined) {
        return lsp.Location.create(
          symbolDocument.uri,
          lsp.Range.create(
            symbolDocument.positionAt(symbol.token.name.token.start),
            symbolDocument.positionAt(symbol.token.name.token.end)
          )
        )
      }
    }

    const includeExpression =
      (parentOfType(token, "Include") as ast.Include | undefined) ||
      (parentOfType(token, "Import") as ast.Import | undefined) ||
      (parentOfType(token, "FromImport") as ast.FromImport | undefined) ||
      (parentOfType(token, "Extends") as ast.Extends | undefined)

    if (
      includeExpression !== undefined &&
      includeExpression.source.type === "StringLiteral"
    ) {
      const importedFilename = (includeExpression.source as ast.StringLiteral)
        .value
      const uri = Utils.joinPath(
        URI.parse(document.uri),
        "..",
        importedFilename
      ).toString()

      const sourceLiteral = includeExpression.source as ast.StringLiteral
      return [
        lsp.LocationLink.create(
          uri,
          lsp.Range.create(
            lsp.Position.create(0, 0),
            lsp.Position.create(0, 0)
          ),
          lsp.Range.create(
            lsp.Position.create(0, 0),
            lsp.Position.create(0, 0)
          ),
          lsp.Range.create(
            document.positionAt(sourceLiteral.tokens[0].start),
            document.positionAt(
              sourceLiteral.tokens[sourceLiteral.tokens.length - 1].end
            )
          )
        ),
      ]
    }

    const blockStatement = parentOfType(token, "Block") as ast.Block | undefined

    if (blockStatement !== undefined && imports !== undefined) {
      const [sourceBlock, sourceBlockDocument] = findSymbol(
        document,
        undefined,
        blockStatement.name.value,
        "Block",
        documents,
        documentASTs,
        documentSymbols,
        documentImports,
        { checkCurrent: false, importTypes: ["Extends"] }
      )

      if (sourceBlock !== undefined && sourceBlockDocument !== undefined) {
        return [
          lsp.LocationLink.create(
            sourceBlockDocument.uri,
            lsp.Range.create(
              document.positionAt(sourceBlock.token.name.token.start),
              document.positionAt(sourceBlock.token.name.token.end)
            ),
            lsp.Range.create(
              document.positionAt(blockStatement.name.token.start),
              document.positionAt(blockStatement.name.token.end)
            ),
            lsp.Range.create(
              document.positionAt(blockStatement.name.token.start),
              document.positionAt(blockStatement.name.token.end)
            )
          ),
        ]
      }
    }

    if (token.parent?.type === "Identifier") {
      const identifier = token.parent as ast.Identifier
      const [symbol, symbolDocument] = findSymbol(
        document,
        identifier,
        identifier.value,
        "Variable",
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )

      if (
        symbol !== undefined &&
        symbolDocument !== undefined &&
        symbol.token.openToken !== undefined &&
        symbol.token.closeToken !== undefined &&
        symbol.token.assignee.type === "Identifier"
      ) {
        const assignee = symbol.token.assignee as ast.Identifier
        return [
          lsp.LocationLink.create(
            symbolDocument.uri,
            lsp.Range.create(
              symbolDocument.positionAt(symbol.token.openToken.start),
              symbolDocument.positionAt(symbol.token.closeToken.end)
            ),
            lsp.Range.create(
              symbolDocument.positionAt(assignee.token.start),
              symbolDocument.positionAt(assignee.token.end)
            )
          ),
        ]
      }
    }
  }
})

connection.onSignatureHelp(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const program = documentASTs.get(params.textDocument.uri)?.program

  if (program !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(program, offset - 1)
    if (!token) {
      return
    }

    const callExpression = parentOfType(token, "CallExpression") as
      | ast.CallExpression
      | undefined

    if (
      callExpression !== undefined &&
      callExpression.callee.type === "Identifier" &&
      callExpression.closeParenToken !== undefined
    ) {
      const callee = callExpression.callee as ast.Identifier
      const name = callee.token.value
      const [symbol] = findSymbol(
        document,
        callExpression,
        name,
        "Macro",
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )
      if (!symbol) {
        return
      }

      const parameters = (symbol.token as ast.Macro).args
        .map(argToParameterInformation)
        .filter((x) => x !== undefined)

      const currentCallText = document
        .getText(
          lsp.Range.create(
            document.positionAt(callee.token.end + 1),
            document.positionAt(callExpression.closeParenToken.start)
          )
        )
        .trimEnd()
      let activeParameter = 0
      const lastPeriod = currentCallText.lastIndexOf(
        ",",
        document.offsetAt(params.position) - callee.token.end - 2
      )
      const nextPeriod = currentCallText.indexOf(",", lastPeriod + 1)
      const currentParameter = currentCallText.slice(
        lastPeriod + 1,
        nextPeriod === -1 ? undefined : nextPeriod
      )
      const previousParameters = currentCallText.slice(0, lastPeriod + 1)
      // TODO: this could also appear inside a string
      const equalIndex = currentParameter.indexOf("=")
      if (equalIndex !== -1) {
        activeParameter = parameters.findIndex(
          (parameter) =>
            parameter.label === currentParameter.slice(0, equalIndex).trim()
        )
      } else if (!previousParameters.includes("=")) {
        for (const c of currentCallText.slice(
          0,
          nextPeriod === -1 ? undefined : nextPeriod
        )) {
          if (c === ",") {
            activeParameter++
          }
        }
      } else {
        activeParameter = -1
      }

      return {
        signatures: [
          lsp.SignatureInformation.create(
            macroToSignature(symbol.token as ast.Macro),
            undefined,
            ...parameters
          ),
        ],
        activeSignature: 0,
        activeParameter,
      } satisfies lsp.SignatureHelp
    }
  }
})

lspDocuments.listen(connection)
connection.listen()
