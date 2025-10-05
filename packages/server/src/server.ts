import { ast, parse, tokenize } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { createConnection } from "vscode-languageserver/node"
import { filters, tests } from "./generated"
import { getTokens, legend } from "./semantic"
import {
  configuration,
  documentASTs,
  documentImports,
  documents,
  documentSymbols,
  globals,
} from "./state"
import {
  collectSymbols,
  findImport,
  findSymbol,
  findSymbolsInScope,
  SymbolInfo,
} from "./symbols"
import { getType, resolveType, stringifySignatureInfo } from "./types"
import { parentOfType, tokenAt, walk } from "./utilities"

const HOVER_LITERAL_MAX_LENGTH = 20

const ReadFileRequest = new lsp.RequestType<
  { uri: string },
  { contents: string },
  void
>("jinja/readFile")

const connection = createConnection(lsp.ProposedFeatures.all)
const lspDocuments = new lsp.TextDocuments(TextDocument)

connection.onInitialize(() => {
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

  if (ast.program) {
    walk(ast.program, (statement) => {
      collectSymbols(statement, symbols, imports)
    })

    documentSymbols.set(document.uri, symbols)

    const documentsToAnalyze: [string, string][] = []
    const resolvedImports: [
      ast.Include | ast.Import | ast.FromImport | ast.Extends,
      string,
    ][] = []
    for (const i of imports) {
      const [uri, contents] = await findImport(
        i,
        document.uri,
        async (uri) =>
          (await connection.sendRequest(ReadFileRequest, { uri }))?.contents,
      )
      documentsToAnalyze.push([uri, contents])
      resolvedImports.push([i, uri])
    }

    documentImports.set(document.uri, resolvedImports)

    for (const [uri, contents] of documentsToAnalyze) {
      if (contents !== documents.get(uri)?.getText()) {
        analyzeDocument(
          TextDocument.create(
            uri,
            document.languageId,
            document.version,
            contents,
          ),
        )
      }
    }
  }
}

lspDocuments.onDidChangeContent(async (event) => {
  if (!configuration.initialized) {
    const currentConfiguration = await connection.workspace.getConfiguration({
      section: "jinjaLS",
    })
    for (const key in currentConfiguration) {
      configuration[key] = currentConfiguration[key]
    }
    configuration.initialized = true
  }

  analyzeDocument(event.document)
})

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

connection.languages.diagnostics.on(async (params) => {
  const documentAST = documentASTs.get(params.textDocument.uri)
  const imports = documentImports.get(params.textDocument.uri)
  const parserErrors = documentAST?.parserErrors
  const lexerErrors = documentAST?.lexerErrors

  const items: lsp.Diagnostic[] = []
  const document = documents.get(params.textDocument.uri)
  if (document !== undefined) {
    for (const e of parserErrors ?? []) {
      if (e instanceof ast.MissingNode) {
        const position = document.positionAt(e.before.start)
        items.push({
          message: `Expected ${e.missingType}`,
          range: lsp.Range.create(position, position),
          severity: lsp.DiagnosticSeverity.Error,
        })
      } else if (e instanceof ast.UnexpectedToken) {
        items.push({
          message: e.message,
          range: lsp.Range.create(
            document.positionAt(e.token.start),
            document.positionAt(e.token.end),
          ),
          severity: lsp.DiagnosticSeverity.Error,
        })
      }
    }

    for (const e of lexerErrors ?? []) {
      items.push({
        message: e.message,
        range: lsp.Range.create(
          document.positionAt(e.start),
          document.positionAt(e.end),
        ),
        severity: lsp.DiagnosticSeverity.Error,
      })
    }
  }

  for (const [i, uri] of imports ?? []) {
    if (uri === undefined) {
      items.push({
        message: "Couldn't resolve import, try adding to Jinja LS import paths",
        range: lsp.Range.create(
          document.positionAt(i.source.getStart()),
          document.positionAt(i.source.getEnd()),
        ),
        severity: lsp.DiagnosticSeverity.Warning,
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
        item.tokenModifiers,
      )
    }
  }

  const result = builder.build()
  return result
})

connection.onHover(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const tokens = documentASTs.get(params.textDocument.uri)?.tokens

  if (tokens !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(tokens, offset)
    if (!token) {
      return
    }

    // Builtin Filter
    if (
      filters[token.value] &&
      token.parent instanceof ast.Identifier &&
      ((token.parent.parent instanceof ast.CallExpression &&
        token.parent.parent.parent instanceof ast.FilterExpression) ||
        token.parent.parent instanceof ast.FilterExpression ||
        token.parent.parent instanceof ast.FilterStatement)
    ) {
      return {
        contents: [
          {
            language: "python",
            value: `(${filters[token.value].parameters
              .map((p) => (p.default ? `${p.name}=${p.default}` : p.name))
              .join(", ")}) -> Any`,
          },
          filters[token.value].brief,
        ],
      } satisfies lsp.Hover
    }

    // Builtin Test
    if (
      tests[token.value] &&
      token.parent instanceof ast.Identifier &&
      ((token.parent.parent instanceof ast.TestExpression &&
        token.parent.parent.test === token.parent) ||
        (token.parent.parent instanceof ast.CallExpression &&
          token.parent.parent.parent instanceof ast.TestExpression &&
          token.parent.parent.callee === token.parent))
    ) {
      return {
        contents: [
          {
            language: "python",
            value: `(${tests[token.value].parameters
              .map((p) => (p.default ? `${p.name}=${p.default}` : p.name))
              .join(", ")}) -> bool`,
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
      token.parent instanceof ast.Identifier &&
      callExpression !== undefined &&
      (callExpression.callee === token.parent ||
        (callExpression.callee instanceof ast.MemberExpression &&
          callExpression.callee.property === token.parent))
    ) {
      // Expression with known function type
      const callee = (callExpression as ast.CallExpression).callee
      const resolvedType = resolveType(getType(callee, document))
      if (resolvedType?.signature !== undefined) {
        const contents: lsp.MarkedString[] = [
          {
            language: "python",
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

      const [symbol, symbolDocument] = findSymbol(
        document,
        token,
        token.value,
        "Macro",
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
                  symbolDocument.positionAt(symbol.node.closeToken.end),
                ),
              ),
            },
          ],
        } satisfies lsp.Hover
      }
    }

    // Block
    if (
      token.parent instanceof ast.Identifier &&
      token.parent.parent instanceof ast.Block &&
      token.parent.parent.name === token.parent
    ) {
      const block = token.parent.parent
      const [blockSymbol, blockDocument] = findSymbol(
        document,
        block,
        block.name.value,
        "Block",
        { checkCurrent: false, importTypes: ["Extends"] },
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
            blockDocument.positionAt(sourceBlock.closeToken.end),
          ),
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

    if (token.parent instanceof ast.Identifier) {
      const identifier = token.parent
      const node =
        identifier.parent instanceof ast.MemberExpression &&
        identifier.parent.property === identifier
          ? identifier.parent
          : identifier
      const nodeType = getType(node, document)
      const resolvedType = resolveType(nodeType)

      if (nodeType !== undefined && resolvedType !== undefined) {
        let value = `${identifier.value}: ${resolvedType.name}`
        if (nodeType.literalValue !== undefined) {
          value += ` = ${nodeType.literalValue.length < HOVER_LITERAL_MAX_LENGTH ? nodeType.literalValue : "..."}`
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
  const tokens = documentASTs.get(params.textDocument.uri)?.tokens
  const imports = documentImports.get(params.textDocument.uri)

  if (tokens !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(tokens, offset)
    if (!token) {
      return
    }

    const callExpression = parentOfType(token, "CallExpression") as
      | ast.CallExpression
      | undefined

    if (
      callExpression !== undefined &&
      callExpression.callee instanceof ast.Identifier
    ) {
      const name = callExpression.callee.value
      const [symbol, symbolDocument] = findSymbol(
        document,
        callExpression,
        name,
        "Macro",
      )

      if (symbol !== undefined && symbolDocument !== undefined) {
        return lsp.Location.create(
          symbolDocument.uri,
          lsp.Range.create(
            symbolDocument.positionAt(symbol.node.name.token.start),
            symbolDocument.positionAt(symbol.node.name.token.end),
          ),
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
      includeExpression.source instanceof ast.StringLiteral
    ) {
      const uri = (imports.find((i) => i[0] === includeExpression) ?? [])[1]

      if (uri === undefined) {
        return
      }

      const sourceLiteral = includeExpression.source as ast.StringLiteral
      return [
        lsp.LocationLink.create(
          uri,
          lsp.Range.create(
            lsp.Position.create(0, 0),
            lsp.Position.create(0, 0),
          ),
          lsp.Range.create(
            lsp.Position.create(0, 0),
            lsp.Position.create(0, 0),
          ),
          lsp.Range.create(
            document.positionAt(sourceLiteral.tokens[0].start),
            document.positionAt(
              sourceLiteral.tokens[sourceLiteral.tokens.length - 1].end,
            ),
          ),
        ),
      ]
    }

    const blockStatement = parentOfType(token, "Block") as ast.Block | undefined

    if (
      blockStatement !== undefined &&
      blockStatement.name === token.parent &&
      imports !== undefined
    ) {
      const [sourceBlock, sourceBlockDocument] = findSymbol(
        document,
        blockStatement,
        blockStatement.name.value,
        "Block",
        { checkCurrent: false, importTypes: ["Extends"] },
      )

      if (sourceBlock !== undefined && sourceBlockDocument !== undefined) {
        return [
          lsp.Location.create(
            sourceBlockDocument.uri,
            lsp.Range.create(
              sourceBlockDocument.positionAt(sourceBlock.node.name.token.start),
              sourceBlockDocument.positionAt(sourceBlock.node.name.token.end),
            ),
          ),
        ]
      }
    }

    if (token.parent instanceof ast.Identifier) {
      const identifier = token.parent
      const [symbol, symbolDocument] = findSymbol(
        document,
        identifier,
        identifier.value,
        "Variable",
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
              symbolDocument.positionAt(symbol.identifierNode.token.end),
            ),
          ),
        ]
      }
    }
  }
})

connection.onSignatureHelp(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const tokens = documentASTs.get(params.textDocument.uri)?.tokens

  if (tokens !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(tokens, offset - 1)
    if (!token) {
      return
    }

    const callExpression = parentOfType(token, "CallExpression") as
      | ast.CallExpression
      | undefined

    if (callExpression !== undefined) {
      if (
        callExpression.callee instanceof ast.Identifier &&
        callExpression.closeParenToken !== undefined
      ) {
        const callee = callExpression.callee
        const symbolType = getType(callee, document)
        const resolvedType = resolveType(symbolType)
        const calleeEnd = callee.getEnd()

        if (
          symbolType !== undefined &&
          resolvedType?.signature !== undefined &&
          calleeEnd !== undefined
        ) {
          const parameters =
            resolvedType.signature.arguments?.map(
              (argument) =>
                ({ label: argument.name }) satisfies lsp.ParameterInformation,
            ) ?? []

          const currentCallText = document
            .getText(
              lsp.Range.create(
                document.positionAt(calleeEnd + 1),
                document.positionAt(callExpression.closeParenToken.start),
              ),
            )
            .trimEnd()
          let activeParameter = 0
          const lastPeriod = currentCallText.lastIndexOf(
            ",",
            document.offsetAt(params.position) - calleeEnd - 2,
          )
          const nextPeriod = currentCallText.indexOf(",", lastPeriod + 1)
          const currentParameter = currentCallText.slice(
            lastPeriod + 1,
            nextPeriod === -1 ? undefined : nextPeriod,
          )
          const previousParameters = currentCallText.slice(0, lastPeriod + 1)
          // TODO: this could also appear inside a string
          const equalIndex = currentParameter.indexOf("=")
          if (equalIndex !== -1) {
            activeParameter = parameters.findIndex(
              (parameter) =>
                parameter.label ===
                currentParameter.slice(0, equalIndex).trim(),
            )
          } else if (!previousParameters.includes("=")) {
            for (const c of currentCallText.slice(
              0,
              nextPeriod === -1 ? undefined : nextPeriod,
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
                stringifySignatureInfo(resolvedType.signature),
                undefined,
                ...parameters,
              ),
            ],
            activeSignature: 0,
            activeParameter,
          } satisfies lsp.SignatureHelp
        }
      }
    }
  }
})

connection.onCompletion(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const tokens = documentASTs.get(params.textDocument.uri)?.tokens

  if (params.context?.triggerCharacter === " ") {
    const text = document
      .getText(lsp.Range.create(lsp.Position.create(0, 0), params.position))
      .trimEnd()
    if (!(text.endsWith("{{") || text.endsWith("|") || text.endsWith("is"))) {
      return
    }
  }

  if (tokens !== undefined && document !== undefined) {
    const offset = document.offsetAt(params.position)
    const token = tokenAt(tokens, offset)
    if (!token) {
      return
    }

    if (
      (token.parent?.parent instanceof ast.TestExpression &&
        token.parent.parent.test === token.parent) ||
      (token.value === "is" &&
        token.parent instanceof ast.TestExpression &&
        token.parent.test instanceof ast.Identifier &&
        token.parent.test.value === "error")
    ) {
      return Object.entries(tests)
        .filter(([testName]) => /\w/.test(testName))
        .map(
          ([testName, test]) =>
            ({
              label: testName,
              kind: lsp.CompletionItemKind.Function,
              documentation: test.brief,
            }) satisfies lsp.CompletionItem,
        )
    }

    if (
      (token.parent instanceof ast.Identifier &&
        token.parent.parent instanceof ast.FilterExpression &&
        token.parent.parent.filter.identifierName === token.parent.value) ||
      (token.value === "|" &&
        token.parent instanceof ast.FilterExpression &&
        token.parent.filter instanceof ast.Identifier &&
        token.parent.filter.value === "error")
    ) {
      return Object.entries(filters).map(
        ([filterName, filter]) =>
          ({
            label: filterName,
            kind: lsp.CompletionItemKind.Function,
            documentation: filter.brief,
          }) satisfies lsp.CompletionItem,
      )
    }

    if (token.parent instanceof ast.MemberExpression) {
      const object = token.parent.object
      const symbolType = getType(object, document)
      const resolvedType = resolveType(symbolType)

      if (resolvedType !== undefined) {
        const completions: lsp.CompletionItem[] = []
        for (const [key, value] of Object.entries(
          resolvedType.properties ?? {},
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
          } else if (
            typeof value !== "string" &&
            value.documentation !== undefined
          ) {
            documentation = value.documentation
          }
          completions.push({ label: key, kind, documentation })
        }
        return completions
      }
    } else if (token.parent !== undefined) {
      const symbols = findSymbolsInScope(token.parent, "Variable", document)
      const completions: lsp.CompletionItem[] = []
      for (const [symbolName, [symbol, document]] of symbols.entries()) {
        const type = symbol?.getType(document)
        const resolvedType = resolveType(type)
        let kind: lsp.CompletionItemKind = lsp.CompletionItemKind.Variable
        if (type !== undefined && resolvedType !== undefined) {
          if (resolvedType.signature !== undefined) {
            kind = lsp.CompletionItemKind.Function
          }
        }

        completions.push({
          label: symbolName,
          kind,
        })
      }
      return completions
    }
  }
})

connection.onRequest(
  "jinja/setGlobals",
  async ({
    globals: globalsToAdd,
    merge,
  }: {
    globals: Record<string, unknown>
    merge: boolean
  }) => {
    if (!merge) {
      for (const key in globals) {
        delete globals[key]
      }
    }

    for (const key in globalsToAdd) {
      globals[key] = globalsToAdd[key]
    }

    return { success: true }
  },
)

lspDocuments.listen(connection)
connection.listen()
