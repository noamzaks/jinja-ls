import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { createConnection } from "vscode-languageserver/node"
import { URI, Utils } from "vscode-uri"
import { ast, LexerError, parse, tokenize } from "../../language"
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
import { getType, resolveType, stringifySignatureInfo } from "./types"
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
      completionProvider: {
        triggerCharacters: ["."],
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
      const resolvedType = resolveType(
        getType(
          callee,
          document,
          documents,
          documentASTs,
          documentSymbols,
          documentImports
        )
      )
      if (resolvedType?.signature !== undefined) {
        const contents: lsp.MarkedString[] = [
          {
            language: "python",
            // TODO: arguments
            value: stringifySignatureInfo(resolvedType.signature),
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
        symbol.node.openToken !== undefined &&
        symbol.node.closeToken !== undefined
      ) {
        return {
          contents: [
            {
              language: "jinja",
              value: symbolDocument.getText(
                lsp.Range.create(
                  symbolDocument.positionAt(symbol.node.openToken.start),
                  symbolDocument.positionAt(symbol.node.closeToken.end)
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
      const sourceBlock = blockSymbol?.node as ast.Block | undefined
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
      const node =
        identifier.parent?.type === "MemberExpression" &&
        (identifier.parent as ast.MemberExpression).property === identifier
          ? (identifier.parent as ast.MemberExpression)
          : identifier
      const nodeType = getType(
        node,
        document,
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )
      const resolvedType = resolveType(nodeType)

      if (nodeType !== undefined && resolvedType !== undefined) {
        let value = `${identifier.value}: ${resolvedType.name}`
        if (nodeType.literalValue !== undefined) {
          value += ` = ${nodeType.literalValue}`
        }
        const contents: lsp.MarkedString[] = [
          {
            language: "python",
            value,
          },
        ]
        if (nodeType.documentation) {
          contents.push(nodeType.documentation)
        }
        return {
          contents,
        } satisfies lsp.Hover
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
            symbolDocument.positionAt(symbol.node.name.token.start),
            symbolDocument.positionAt(symbol.node.name.token.end)
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
              document.positionAt(sourceBlock.node.name.token.start),
              document.positionAt(sourceBlock.node.name.token.end)
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
        symbol.identifierNode !== undefined
      ) {
        return [
          lsp.Location.create(
            symbolDocument.uri,
            lsp.Range.create(
              symbolDocument.positionAt(symbol.identifierNode.token.start),
              symbolDocument.positionAt(symbol.identifierNode.token.end)
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

    if (callExpression !== undefined) {
      if (
        callExpression.callee.type === "Identifier" &&
        callExpression.closeParenToken !== undefined
      ) {
        const callee = callExpression.callee as ast.Identifier
        const name = callee.token.value

        const [macro] = findSymbol(
          document,
          callExpression,
          name,
          "Macro",
          documents,
          documentASTs,
          documentSymbols,
          documentImports
        )
        if (macro) {
          const parameters = (macro.node as ast.Macro).args
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
                macroToSignature(macro.node as ast.Macro),
                undefined,
                ...parameters
              ),
            ],
            activeSignature: 0,
            activeParameter,
          } satisfies lsp.SignatureHelp
        }
      }

      const symbolType = resolveType(
        getType(
          callExpression.callee,
          document,
          documents,
          documentASTs,
          documentSymbols,
          documentImports
        )
      )
      if (symbolType?.signature !== undefined) {
        return {
          signatures: [
            lsp.SignatureInformation.create(
              stringifySignatureInfo(symbolType.signature),
              symbolType.signature.documentation
              // TODO
              // ...parameters
            ),
          ],
          activeSignature: 0,
          // TODO
          // activeParameter,
        } satisfies lsp.SignatureHelp
      }
    }
  }
})

connection.onCompletion(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const program = documentASTs.get(params.textDocument.uri)?.program

  if (program !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(program, offset)
    if (!token) {
      return
    }

    if (token.parent?.type === "MemberExpression") {
      const object = (token.parent as ast.MemberExpression).object
      const symbolType = getType(
        object,
        document,
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )
      const resolvedType = resolveType(symbolType)

      if (resolvedType !== undefined) {
        const completions: lsp.CompletionItem[] = []
        for (const [key, value] of Object.entries(
          resolvedType.properties ?? {}
        )) {
          // Don't show array indexing as properties
          if (!isNaN(parseInt(key, 10))) {
            continue
          }

          let kind: lsp.CompletionItemKind = lsp.CompletionItemKind.Property
          let documentation: lsp.MarkupContent | string | undefined = undefined
          const valueType = resolveType(value)
          if (valueType?.signature) {
            kind = lsp.CompletionItemKind.Method
            const docs =
              valueType?.signature?.documentation ?? symbolType?.documentation
            documentation = {
              kind: "markdown",
              value:
                "```python\n" +
                stringifySignatureInfo(valueType.signature) +
                "\n```" +
                (docs !== undefined ? "\n" + docs : ""),
            }
            // @ts-ignore
          } else if (value?.documentation) {
            // @ts-ignore
            documentation = value.documentation
          }
          completions.push({ label: key, kind, documentation })
        }
        return completions
      }
    }
  }
})

lspDocuments.listen(connection)
connection.listen()
