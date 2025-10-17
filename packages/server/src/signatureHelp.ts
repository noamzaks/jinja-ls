import { ast } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { documentASTs, documents } from "./state"
import { getType, resolveType, stringifySignatureInfo } from "./types"
import { parentOfType, tokenAt } from "./utilities"

export const getSignatureHelp = async (uri: string, position: lsp.Position) => {
  const document = documents.get(uri)
  const tokens = documentASTs.get(uri)?.tokens

  if (tokens !== undefined && document !== undefined) {
    const offset = document.offsetAt(position)
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
            document.offsetAt(position) - calleeEnd - 2,
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
}
