import { ast } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
export interface SemanticToken {
  start: number
  end: number
  tokenType: number
  tokenModifiers: number
}

export const legend: lsp.SemanticTokensLegend = {
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
    "text",
  ],
  tokenModifiers: ["definition", "modification", "defaultLibrary", "readonly"],
}

export const getTokens = (statements: ast.Statement[]) => {
  const items: SemanticToken[] = []
  while (statements.length !== 0) {
    const statement = statements.pop()!
    if (statement === undefined) {
      continue
    }

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
        statements.push(...programStatement.body)
        break
      case "If":
        const ifStatement = statement as ast.If
        statements.push(
          ifStatement.test,
          ...ifStatement.body,
          ...ifStatement.alternate
        )
        if (ifStatement.elseIdentifier) {
          items.push({
            start: ifStatement.elseIdentifier.start,
            end: ifStatement.elseIdentifier.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        break
      case "For":
        const forStatement = statement as ast.For
        statements.push(
          forStatement.loopvar,
          forStatement.iterable,
          ...forStatement.body,
          ...forStatement.defaultBlock
        )
        if (forStatement.inToken !== undefined) {
          items.push({
            start: forStatement.inToken.start,
            end: forStatement.inToken.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        break
      case "Raw":
        const rawStatement = statement as ast.Raw
        if (
          rawStatement.closeToken !== undefined &&
          rawStatement.closerOpenToken !== undefined
        ) {
          items.push({
            start: rawStatement.closeToken.end,
            end: rawStatement.closerOpenToken.start,
            tokenType: 11,
            tokenModifiers: 0,
          })
        }
        break
      case "Block":
        const blockStatement = statement as ast.Block
        statements.push(...blockStatement.body)
        if (blockStatement.required) {
          items.push({
            start: blockStatement.required.start,
            end: blockStatement.required.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        if (blockStatement.scoped) {
          items.push({
            start: blockStatement.scoped.start,
            end: blockStatement.scoped.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
      case "Extends":
        const extendsStatement = statement as ast.Extends
        statements.push(extendsStatement.source)
        break
      case "Include":
        const includeStatement = statement as ast.Include
        statements.push(includeStatement.source)
        if (includeStatement.context) {
          items.push({
            start: includeStatement.context.token.start,
            end: includeStatement.context.token.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        if (includeStatement.ignoreMissing) {
          items.push({
            start: includeStatement.ignoreMissing.token.start,
            end: includeStatement.ignoreMissing.token.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        break
      case "FromImport":
        const fromImportStatement = statement as ast.FromImport
        statements.push(fromImportStatement.source)
        for (const importPart of fromImportStatement.imports) {
          statements.push(importPart.source)
          if (importPart.name) {
            statements.push(importPart.name)
          }
          if (importPart.asToken) {
            items.push({
              start: importPart.asToken.start,
              end: importPart.asToken.end,
              tokenType: 8,
              tokenModifiers: 0,
            })
          }
        }
        items.push({
          start: fromImportStatement.importToken.start,
          end: fromImportStatement.importToken.end,
          tokenType: 8,
          tokenModifiers: 0,
        })
        if (fromImportStatement.context) {
          items.push({
            start: fromImportStatement.context.token.start,
            end: fromImportStatement.context.token.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        break
      case "Import":
        const importStatement = statement as ast.Import
        statements.push(importStatement.name)
        items.push({
          start: importStatement.asToken.start,
          end: importStatement.asToken.end,
          tokenType: 8,
          tokenModifiers: 0,
        })
        if (importStatement.context) {
          items.push({
            start: importStatement.context.token.start,
            end: importStatement.context.token.end,
            tokenType: 8,
            tokenModifiers: 0,
          })
        }
        break
      case "Set":
        const setStatement = statement as ast.SetStatement
        statements.push(setStatement.assignee, ...setStatement.body)
        if (setStatement.value !== null) {
          statements.push(setStatement.value)
        }
        break
      case "Macro":
        const macroStatement = statement as ast.Macro
        statements.push(...macroStatement.args, ...macroStatement.body)
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
        statements.push(memberExpressionStatement.object)
        if (memberExpressionStatement.property.type === "Identifier") {
          const property = memberExpressionStatement.property as ast.Identifier
          items.push({
            start: property.token.start,
            end: property.token.end,
            tokenType: 10,
            tokenModifiers: 0,
          })
        } else {
          statements.push(memberExpressionStatement.property)
        }
        break
      case "CallExpression":
        const callExpressionStatement = statement as ast.CallExpression
        statements.push(...callExpressionStatement.args)
        if (callExpressionStatement.callee.type === "Identifier") {
          const callee = callExpressionStatement.callee as ast.Identifier
          items.push({
            start: callee.token.start,
            end: callee.token.end,
            tokenType: 0,
            tokenModifiers: 0,
          })
        } else if (
          callExpressionStatement.callee.type === "MemberExpression" &&
          (callExpressionStatement.callee as ast.MemberExpression).property
            .type === "Identifier"
        ) {
          const callee = callExpressionStatement.callee as ast.MemberExpression
          const property = callee.property as ast.Identifier
          items.push({
            start: property.token.start,
            end: property.token.end,
            tokenType: 0,
            tokenModifiers: 0,
          })
        } else {
          statements.push(callExpressionStatement.callee)
        }
        break
      case "Identifier":
        const identifierStatement = statement as ast.Identifier
        let tokenType = 9
        if (
          ["true", "false", "none", "True", "False", "None"].includes(
            identifierStatement.value
          )
        ) {
          // Render built-in constants as macros, the colors match
          tokenType = 3
        }
        items.push({
          start: identifierStatement.token.start,
          end: identifierStatement.token.end,
          tokenType,
          tokenModifiers: 0,
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
        if (stringLiteralStatement.tokens[0].token.type === "StringLiteral") {
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
        statements.push(...arrayLiteralStatement.value)
        break
      case "TupleLiteral":
        const tupleLiteralStatement = statement as ast.TupleLiteral
        statements.push(...tupleLiteralStatement.value)
        break
      case "ObjectLiteral":
        const objectLiteralStatement = statement as ast.ObjectLiteral
        statements.push(
          ...objectLiteralStatement.value.keys(),
          ...objectLiteralStatement.value.values()
        )
        break
      case "BinaryExpression":
        const binaryExpressionStatement = statement as ast.BinaryExpression
        statements.push(
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
        statements.push(filterExpressionStatement.operand)
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
          statements.push(filterExpressionStatement.filter)
        }
        break
      case "FilterStatement":
        const filterStatement = statement as ast.FilterStatement
        statements.push(...filterStatement.body)
        if (filterStatement.filter.type === "Identifier") {
          const filter = filterStatement.filter as ast.Identifier
          items.push({
            start: filter.token.start,
            end: filter.token.end,
            tokenType: 0,
            tokenModifiers: 0,
          })
        } else {
          statements.push(filterStatement.filter)
        }
        break
      case "SelectExpression":
        const selectExpressionStatement = statement as ast.SelectExpression
        statements.push(
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
        statements.push(testExpressionStatement.operand)
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
        items.push({
          start: testExpressionStatement.test.token.start,
          end: testExpressionStatement.test.token.end,
          tokenType: 0,
          tokenModifiers: 4,
        })
        break
      case "UnaryExpression":
        const unaryExpressionStatement = statement as ast.UnaryExpression
        statements.push(unaryExpressionStatement.argument)
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
          statements.push(sliceExpressionStatement.start)
        }
        if (sliceExpressionStatement.stop) {
          statements.push(sliceExpressionStatement.stop)
        }
        if (sliceExpressionStatement.step) {
          statements.push(sliceExpressionStatement.step)
        }
        break
      case "KeywordArgumentExpression":
        const keywordArgumentExpression =
          statement as ast.KeywordArgumentExpression
        statements.push(
          keywordArgumentExpression.key,
          keywordArgumentExpression.value
        )
        break
      case "SpreadExpression":
        const spreadExpression = statement as ast.SpreadExpression
        statements.push(spreadExpression.argument)
        break
      case "CallStatement":
        const callStatement = statement as ast.CallStatement
        statements.push(
          callStatement.call,
          ...(callStatement.callerArgs ?? []),
          ...callStatement.body
        )
        break
      case "Ternary":
        const ternaryStatement = statement as ast.Ternary
        statements.push(
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
  return items.sort((a, b) => a.start - b.start)
}
