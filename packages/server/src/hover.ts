import { ast } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { HOVER_LITERAL_MAX_LENGTH } from "./constants"
import { documentASTs, documents } from "./state"
import { findSymbol } from "./symbols"
import { getType, resolveType, stringifySignatureInfo } from "./types"
import { parentOfType, tokenAt } from "./utilities"

export const getHover = async (uri: string, position: lsp.Position) => {
  const document = documents.get(uri)
  const tokens = documentASTs.get(uri)?.tokens

  if (tokens !== undefined && document !== undefined) {
    const offset = document.offsetAt(position)
    const token = tokenAt(tokens, offset)
    if (!token) {
      return
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
      const callee = callExpression.callee
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
        let value: string
        if (resolvedType.signature !== undefined) {
          value = stringifySignatureInfo(resolvedType.signature)
        } else {
          value = `${identifier.value}: ${resolvedType.name}`
          if (nodeType.literalValue !== undefined) {
            value += ` = ${nodeType.literalValue.length < HOVER_LITERAL_MAX_LENGTH ? nodeType.literalValue : "..."}`
          }
        }
        const contents: lsp.MarkedString[] = [
          {
            language: "python",
            value,
          },
        ]
        if (nodeType.documentation ?? resolvedType?.signature?.documentation) {
          contents.push(
            nodeType.documentation ?? resolvedType?.signature?.documentation,
          )
        }
        return {
          contents,
        } satisfies lsp.Hover
      }
    }
  }
}
