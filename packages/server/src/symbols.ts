import { ast, formatExpression } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { URI, Utils } from "vscode-uri"

export type SymbolInfo =
  | {
      type: "Macro"
      token: ast.Macro
    }
  | {
      type: "Block"
      token: ast.Block
    }

export const collectSymbols = (
  uri: string,
  statement: ast.Node,
  result: Map<string, SymbolInfo>,
  imports: (ast.Include | ast.Import | ast.FromImport | ast.Extends)[]
) => {
  if (statement.type === "Macro") {
    const macroStatement = statement as ast.Macro
    result.set(macroStatement.name.value, {
      type: "Macro",
      token: macroStatement,
    })
  } else if (statement.type === "Block") {
    const blockStatement = statement as ast.Block
    result.set(blockStatement.name.value, {
      type: "Block",
      token: blockStatement,
    })
  } else if (
    statement.type === "Import" ||
    statement.type === "Include" ||
    statement.type === "FromImport" ||
    statement.type === "Extends"
  ) {
    const s = statement as
      | ast.Import
      | ast.Include
      | ast.FromImport
      | ast.Extends

    imports.push(s)
  }
}

export const argToPython = (arg: ast.Statement) => {
  if (arg.type === "Identifier") {
    const identifier = arg as ast.Identifier
    return identifier.token.value
  } else if (arg.type === "KeywordArgumentExpression") {
    const kwarg = arg as ast.KeywordArgumentExpression
    return `${kwarg.key.token.value} = ${formatExpression(kwarg.value)}`
  }
}

export const argToParameterInformation = (
  arg: ast.Statement
): lsp.ParameterInformation | undefined => {
  if (arg.type === "Identifier") {
    const identifier = arg as ast.Identifier
    return { label: identifier.token.value }
  } else if (arg.type === "KeywordArgumentExpression") {
    const kwarg = arg as ast.KeywordArgumentExpression
    return { label: kwarg.key.token.value }
  }
}

export const macroToDocumentation = (macro: ast.Macro) => {
  return macro.args.length === 0
    ? `(macro) def ${macro.name.value}()`
    : `(macro) def ${macro.name.value}(\n\t${macro.args
        .map((arg) => argToPython(arg))
        .filter((x) => x !== undefined)
        .join(", \n\t")}\n)`
}

export const macroToSignature = (macro: ast.Macro) => {
  return `(${macro.args
    .map((arg) => argToPython(arg))
    .filter((x) => x !== undefined)
    .join(", ")}) -> str`
}

export const importToUri = (
  i: ast.Include | ast.Import | ast.FromImport | ast.Extends,
  uri: string
) => {
  if (i.source.type !== "StringLiteral") {
    return
  }
  return Utils.joinPath(
    URI.parse(uri),
    "..",
    (i.source as ast.StringLiteral).value
  ).toString()
}

export const findSymbol = (
  document: TextDocument,
  name: string,
  type: string,
  documents: Map<string, TextDocument>,
  documentSymbols: Map<string, Map<string, SymbolInfo>>,
  documentImports: Map<
    string,
    (ast.Include | ast.Import | ast.FromImport | ast.Extends)[]
  >
) => {
  const symbols = documentSymbols.get(document.uri)
  const symbol = symbols?.get(name)
  if (symbol?.type === type) {
    return [symbol, document] as const
  }

  const imports = documentImports.get(document.uri)
  for (const importStatement of imports ?? []) {
    const importedUri = importToUri(importStatement, document.uri)
    if (!importedUri) {
      continue
    }
    const importedDocument = documents.get(importedUri)
    if (!importedDocument) {
      continue
    }

    const symbols = documentSymbols.get(importedUri)
    const symbol = symbols?.get(name)
    if (symbol?.type === type) {
      return [symbol, importedDocument] as const
    }
  }

  return []
}
