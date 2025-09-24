import { ast, LexerError, parse, tokenize } from "@jinja-lsp/language"
import { ParserError } from "@jinja-lsp/language/out/errors"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { createConnection } from "vscode-languageserver/node"

const connection = createConnection(lsp.ProposedFeatures.all)
const documents = new lsp.TextDocuments(TextDocument)

connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
      semanticTokensProvider: {
        legend: {
          tokenTypes: [
            "function",
            "parameter",
            "method",
            "macro",
            "comment",
            "string",
            "number",
            "operator",
            "keyword",
            "variable",
            "property",
          ],
          tokenModifiers: [
            "definition",
            "modification",
            "defaultLibrary",
            "readonly",
          ],
        },
        documentSelector: [
          { scheme: "file", language: "jinja" },
          { scheme: "file", language: "jinja-md" },
        ],
        full: true,
      },
    },
  } satisfies lsp.InitializeResult
})

connection.languages.diagnostics.on(async (params) => {
  const document = documents.get(params.textDocument.uri)
  let items: lsp.Diagnostic[] = []
  if (document !== undefined) {
    items = await processDocument(document)
  }

  return {
    kind: lsp.DocumentDiagnosticReportKind.Full,
    items,
  } satisfies lsp.DocumentDiagnosticReport
})

interface SemanticToken {
  start: number
  end: number
  tokenType: number
  tokenModifiers: number
}

const addTokens = (items: SemanticToken[], ...statements: ast.Statement[]) => {
  for (const statement of statements) {
    if (statement.identifier) {
      items.push({
        start: statement.identifier.start,
        end: statement.identifier.end,
        tokenType: 8,
        tokenModifiers: 4,
      })
    }
    if (statement.closerIdentifier) {
      items.push({
        start: statement.closerIdentifier.start,
        end: statement.closerIdentifier.end,
        tokenType: 8,
        tokenModifiers: 4,
      })
    }

    switch (statement.type) {
      case "Program":
        const programStatement = statement as ast.Program
        addTokens(items, ...programStatement.body)
        break
      case "If":
        const ifStatement = statement as ast.If
        addTokens(
          items,
          ifStatement.test,
          ...ifStatement.body,
          ...ifStatement.alternate
        )
        break
      case "For":
        const forStatement = statement as ast.For
        addTokens(
          items,
          forStatement.loopvar,
          forStatement.iterable,
          ...forStatement.body,
          ...forStatement.defaultBlock
        )
        items.push({
          start: forStatement.inToken.start,
          end: forStatement.inToken.end,
          tokenType: 8,
          tokenModifiers: 0,
        })
        break
      case "Break":
        const breakStatement = statement as ast.Break
        break
      case "Continue":
        const continueStatement = statement as ast.Continue
        break
      case "Set":
        const setStatement = statement as ast.SetStatement
        addTokens(items, setStatement.assignee, ...setStatement.body)
        if (setStatement.value !== null) {
          addTokens(items, setStatement.value)
        }
        break
      case "Macro":
        const macroStatement = statement as ast.Macro
        addTokens(items, ...macroStatement.args, ...macroStatement.body)
        items.push({
          start: macroStatement.name.token.start,
          end: macroStatement.name.token.end,
          tokenType: 0,
          tokenModifiers: 0,
        })
        break
      case "Comment":
        const commentStatement = statement as ast.Comment
        items.push({
          start: commentStatement.token.start,
          end: commentStatement.token.end,
          tokenType: 4,
          tokenModifiers: 0,
        })
        break
      case "MemberExpression":
        const memberExpressionStatement = statement as ast.MemberExpression
        addTokens(items, memberExpressionStatement.object)
        if (memberExpressionStatement.property.type === "Identifier") {
          const property = memberExpressionStatement.property as ast.Identifier
          items.push({
            start: property.token.start,
            end: property.token.end,
            tokenType: 10,
            tokenModifiers: 0,
          })
        } else {
          addTokens(items, memberExpressionStatement.property)
        }
        break
      case "CallExpression":
        const callExpressionStatement = statement as ast.CallExpression
        addTokens(items, ...callExpressionStatement.args)
        if (callExpressionStatement.callee.type === "Identifier") {
          const callee = callExpressionStatement.callee as ast.Identifier
          items.push({
            start: callee.token.start,
            end: callee.token.end,
            tokenType: 0,
            tokenModifiers: 0,
          })
        } else {
          addTokens(items, callExpressionStatement.callee)
        }
        break
      case "Identifier":
        const identifierStatement = statement as ast.Identifier
        let tokenModifiers = 0
        if (
          ["true", "false", "none", "True", "False", "None"].includes(
            identifierStatement.value
          )
        ) {
          tokenModifiers = 8
        }
        items.push({
          start: identifierStatement.token.start,
          end: identifierStatement.token.end,
          tokenType: 9,
          tokenModifiers,
        })
        break
      case "IntegerLiteral":
        const integerLiteralStatement = statement as ast.IntegerLiteral
        items.push({
          start: integerLiteralStatement.token.start,
          end: integerLiteralStatement.token.end,
          tokenType: 6,
          tokenModifiers: 0,
        })
        break
      case "FloatLiteral":
        const floatLiteralStatement = statement as ast.FloatLiteral
        items.push({
          start: floatLiteralStatement.token.start,
          end: floatLiteralStatement.token.end,
          tokenType: 6,
          tokenModifiers: 0,
        })
        break
      case "StringLiteral":
        const stringLiteralStatement = statement as ast.StringLiteral
        if (stringLiteralStatement.tokens[0].type === "StringLiteral") {
          items.push({
            start: stringLiteralStatement.tokens[0].start,
            end: stringLiteralStatement.tokens[
              stringLiteralStatement.tokens.length - 1
            ].end,
            tokenType: 5,
            tokenModifiers: 0,
          })
        }
        break
      case "ArrayLiteral":
        const arrayLiteralStatement = statement as ast.ArrayLiteral
        addTokens(items, ...arrayLiteralStatement.value)
        break
      case "TupleLiteral":
        const tupleLiteralStatement = statement as ast.TupleLiteral
        addTokens(items, ...tupleLiteralStatement.value)
        break
      case "ObjectLiteral":
        const objectLiteralStatement = statement as ast.ObjectLiteral
        addTokens(
          items,
          ...objectLiteralStatement.value.keys(),
          ...objectLiteralStatement.value.values()
        )
        break
      case "BinaryExpression":
        const binaryExpressionStatement = statement as ast.BinaryExpression
        addTokens(
          items,
          binaryExpressionStatement.left,
          binaryExpressionStatement.right
        )
        items.push({
          start: binaryExpressionStatement.operator.start,
          end: binaryExpressionStatement.operator.end,
          tokenType: 7,
          tokenModifiers: 0,
        })
        break
      case "FilterExpression":
        const filterExpressionStatement = statement as ast.FilterExpression
        addTokens(items, filterExpressionStatement.operand)
        items.push({
          start: filterExpressionStatement.pipeToken.start,
          end: filterExpressionStatement.pipeToken.end,
          tokenType: 7,
          tokenModifiers: 0,
        })
        if (filterExpressionStatement.filter.type === "Identifier") {
          const filter = filterExpressionStatement.filter as ast.Identifier
          items.push({
            start: filter.token.start,
            end: filter.token.end,
            tokenType: 0,
            tokenModifiers: 0,
          })
        } else {
          addTokens(items, filterExpressionStatement.filter)
        }
        break
      case "FilterStatement":
        const filterStatement = statement as ast.FilterStatement
        addTokens(items, ...filterStatement.body)
        if (filterStatement.filter.type === "Identifier") {
          const filter = filterStatement.filter as ast.Identifier
          items.push({
            start: filter.token.start,
            end: filter.token.end,
            tokenType: 0,
            tokenModifiers: 0,
          })
        } else {
          addTokens(items, filterStatement.filter)
        }
        break
      case "SelectExpression":
        const selectExpressionStatement = statement as ast.SelectExpression
        addTokens(
          items,
          selectExpressionStatement.lhs,
          selectExpressionStatement.test
        )
        if (selectExpressionStatement.ifToken) {
          items.push({
            start: selectExpressionStatement.ifToken.start,
            end: selectExpressionStatement.ifToken.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        break
      case "TestExpression":
        const testExpressionStatement = statement as ast.TestExpression
        addTokens(items, testExpressionStatement.operand)
        items.push({
          start: testExpressionStatement.isToken.start,
          end: testExpressionStatement.isToken.end,
          tokenType: 8,
          tokenModifiers: 0,
        })
        if (testExpressionStatement.notToken) {
          items.push({
            start: testExpressionStatement.notToken.start,
            end: testExpressionStatement.notToken.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        break
      case "UnaryExpression":
        const unaryExpressionStatement = statement as ast.UnaryExpression
        addTokens(items, unaryExpressionStatement.argument)
        items.push({
          start: unaryExpressionStatement.operator.start,
          end: unaryExpressionStatement.operator.end,
          tokenType: 8,
          tokenModifiers: 0,
        })
        break
      case "SliceExpression":
        const sliceExpressionStatement = statement as ast.SliceExpression
        if (sliceExpressionStatement.start) {
          addTokens(items, sliceExpressionStatement.start)
        }
        if (sliceExpressionStatement.stop) {
          addTokens(items, sliceExpressionStatement.stop)
        }
        if (sliceExpressionStatement.step) {
          addTokens(items, sliceExpressionStatement.step)
        }
        break
      case "KeywordArgumentExpression":
        const keywordArgumentExpression =
          statement as ast.KeywordArgumentExpression
        addTokens(
          items,
          keywordArgumentExpression.key,
          keywordArgumentExpression.value
        )
        break
      case "SpreadExpression":
        const spreadExpression = statement as ast.SpreadExpression
        addTokens(items, spreadExpression.argument)
        break
      case "CallStatement":
        const callStatement = statement as ast.CallStatement
        addTokens(
          items,
          callStatement.call,
          ...(callStatement.callerArgs ?? []),
          ...callStatement.body
        )
        break
      case "Ternary":
        const ternaryStatement = statement as ast.Ternary
        addTokens(
          items,
          ternaryStatement.condition,
          ternaryStatement.trueExpr,
          ternaryStatement.falseExpr
        )
        items.push({
          start: ternaryStatement.ifToken.start,
          end: ternaryStatement.ifToken.end,
          tokenType: 8,
          tokenModifiers: 0,
        })
        items.push({
          start: ternaryStatement.elseToken.start,
          end: ternaryStatement.elseToken.end,
          tokenType: 8,
          tokenModifiers: 0,
        })
        break
    }
  }
}

connection.languages.semanticTokens.on(async (params) => {
  const document = documents.get(params.textDocument.uri)
  const builder = new lsp.SemanticTokensBuilder()

  if (document !== undefined) {
    try {
      const tokens = tokenize(document.getText())
      const program = parse(tokens)
      let items: SemanticToken[] = []
      addTokens(items, program)
      items = items.sort((a, b) => a.start - b.start)
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
    } catch (e) {}
  }

  const result = builder.build()
  return result
})

const processDocument = async (document: TextDocument) => {
  const items: lsp.Diagnostic[] = []
  try {
    const tokens = tokenize(document.getText())
    const program = parse(tokens)
  } catch (e) {
    if (e instanceof LexerError || e instanceof ParserError) {
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
  return items
}

documents.listen(connection)
connection.listen()
