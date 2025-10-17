import { ast } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { documentASTs, documentImports, documents } from "./state"
import { findSymbol } from "./symbols"
import { parentOfType, tokenAt } from "./utilities"

export const getDefinition = async (uri: string, position: lsp.Position) => {
  const document = documents.get(uri)
  const tokens = documentASTs.get(uri)?.tokens
  const imports = documentImports.get(uri)

  if (tokens !== undefined && document !== undefined) {
    const offset = document.offsetAt(position)
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
}
