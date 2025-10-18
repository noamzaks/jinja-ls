import { ast } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { documentASTs, documents, getFilters, getTests } from "./state"
import { findSymbolsInScope } from "./symbols"
import { getType, resolveType, stringifySignatureInfo } from "./types"
import { parentOfType, tokenAt } from "./utilities"

export const getCompletion = async (
  uri: string,
  position: lsp.Position,
  triggerCharacter: string | undefined,
) => {
  const document = documents.get(uri)
  const tokens = documentASTs.get(uri)?.tokens

  if (triggerCharacter === " ") {
    const text = document
      .getText(lsp.Range.create(lsp.Position.create(0, 0), position))
      .trimEnd()
    const lastLine = text.slice(text.lastIndexOf("\n") + 1)
    if (
      !(
        text.endsWith("{{") ||
        text.endsWith("|") ||
        text.endsWith("is") ||
        /{%[ \t]*filter/.test(lastLine) ||
        /{%[ \t]*block/.test(lastLine)
      )
    ) {
      return
    }
  }

  if (tokens !== undefined && document !== undefined) {
    const offset = document.offsetAt(position)
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
      return Object.entries(getTests())
        .filter(([testName]) => /\w/.test(testName))
        .map(
          ([testName, test]) =>
            ({
              label: testName,
              kind: lsp.CompletionItemKind.Function,
              documentation: test?.signature?.documentation,
            }) satisfies lsp.CompletionItem,
        )
    }

    if (
      (token.parent instanceof ast.Identifier &&
        (token.parent.parent instanceof ast.FilterExpression ||
          token.parent.parent instanceof ast.FilterStatement) &&
        token.parent.parent.filter.identifierName === token.parent.value) ||
      ((token.parent instanceof ast.FilterExpression ||
        token.parent instanceof ast.FilterStatement) &&
        ((token.parent.filter instanceof ast.Identifier &&
          token.parent.filter.value === "error") ||
          token.parent.filter instanceof ast.MissingNode))
    ) {
      return Object.entries(getFilters()).map(
        ([filterName, filter]) =>
          ({
            label: filterName,
            kind: lsp.CompletionItemKind.Function,
            documentation: filter?.signature?.documentation,
          }) satisfies lsp.CompletionItem,
      )
    }

    const block = parentOfType(token, "Block") as ast.Block | undefined
    if (
      (token.parent instanceof ast.Identifier &&
        token.parent.parent instanceof ast.Block &&
        token.parent.parent.name === token.parent) ||
      (token.parent instanceof ast.Block && token.parent.name.value === "error")
    ) {
      const symbols = findSymbolsInScope(block, "Block", document)
      return Array.from(symbols.keys()).map((symbolName) => ({
        label: symbolName,
        kind: lsp.CompletionItemKind.Function,
      }))
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
    }

    if (token.parent !== undefined) {
      const symbols = findSymbolsInScope(token.parent, "Variable", document)
      const completions: lsp.CompletionItem[] = []
      for (const [symbolName, [symbol, document]] of symbols.entries()) {
        if (
          symbolName === "True" ||
          symbolName === "False" ||
          symbolName === "None"
        ) {
          continue
        }

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
}
