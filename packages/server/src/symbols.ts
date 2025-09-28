import { ast, formatExpression, LexerError } from "@jinja-ls/language"
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
  | { type: "Variable"; token: ast.SetStatement }

export const collectSymbols = (
  statement: ast.Node,
  result: Map<string, SymbolInfo[]>,
  imports: (ast.Include | ast.Import | ast.FromImport | ast.Extends)[]
) => {
  const addSymbol = (name: string, value: SymbolInfo) => {
    const values = result.get(name) ?? []
    values.push(value)
    result.set(name, values)
  }

  if (statement.type === "Macro") {
    const macroStatement = statement as ast.Macro
    addSymbol(macroStatement.name.value, {
      type: "Macro",
      token: macroStatement,
    })
  } else if (statement.type === "Block") {
    const blockStatement = statement as ast.Block
    addSymbol(blockStatement.name.value, {
      type: "Block",
      token: blockStatement,
    })
  } else if (statement.type === "Set") {
    const setStatement = statement as ast.SetStatement
    if (setStatement.assignee.type === "Identifier") {
      const variable = (setStatement.assignee as ast.Identifier).token.value
      addSymbol(variable, {
        type: "Variable",
        token: setStatement,
      })
    }
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

export const getScope = (node: ast.Node | undefined) => {
  if (node?.type === "Block" && (node as ast.Block).scoped === undefined) {
    return
  }

  node = node?.parent
  while (node !== undefined && !node?.definesScope) {
    node = node.parent
  }
  return node
}

export const isInScope = (
  node: ast.Node,
  inScopeOf: ast.Node | undefined,
  program: ast.Program | undefined
) => {
  const symbolScope = getScope(node)
  let currentScope = getScope(inScopeOf) ?? program
  if (currentScope !== undefined) {
    while (currentScope !== undefined) {
      if (currentScope === symbolScope) {
        return true
      }
      currentScope = getScope(currentScope)
    }

    // Not in scope.
    return false
  }
  return false
}

export const findSymbolInDocument = <K extends SymbolInfo["type"]>(
  symbols: Map<string, SymbolInfo[]> | undefined,
  name: string,
  type: K,
  program: ast.Program | undefined,
  inScopeOf: ast.Node | undefined = undefined
): Extract<SymbolInfo, { type: K }> | undefined => {
  // TODO: remove sorting here
  const symbolOptions = (symbols?.get(name) ?? []).sort(
    (a, b) =>
      // @ts-ignore
      (a.token?.name?.token?.start ?? a.token.openToken.start) -
      // @ts-ignore
      (b.token?.name?.token?.start ?? b.token.openToken?.start)
  )

  // Look from the last to the first definition of this symbol to find the last one.
  for (const symbol of symbolOptions.reverse()) {
    if (symbol?.type !== type) {
      continue
    }
    if (!symbol.token) {
      continue
    }
    if (!isInScope(symbol.token, inScopeOf, program)) {
      continue
    }
    return symbol as Extract<SymbolInfo, { type: K }>
  }
}

export const findSymbol = <K extends SymbolInfo["type"]>(
  document: TextDocument,
  inScopeOf: ast.Node | undefined,
  name: string,
  type: K,
  documents: Map<string, TextDocument>,
  documentASTs: Map<
    string,
    {
      program?: ast.Program
      lexerErrors?: LexerError[]
      parserErrors?: ast.ErrorNode[]
    }
  >,
  documentSymbols: Map<string, Map<string, SymbolInfo[]>>,
  documentImports: Map<
    string,
    (ast.Include | ast.Import | ast.FromImport | ast.Extends)[]
  >,
  {
    checkCurrent,
    importTypes,
  }: { checkCurrent?: boolean; importTypes?: string[] } = {
    checkCurrent: true,
  }
): [Extract<SymbolInfo, { type: K }>, TextDocument] | [] => {
  const program = documentASTs.get(document.uri)?.program

  if (checkCurrent) {
    const symbol = findSymbolInDocument(
      documentSymbols.get(document.uri),
      name,
      type,
      program,
      inScopeOf
    )
    if (symbol !== undefined) {
      return [symbol, document]
    }
  }

  const imports = documentImports.get(document.uri)
  for (const importStatement of imports ?? []) {
    if (
      importTypes !== undefined &&
      !importTypes.includes(importStatement.type)
    ) {
      continue
    }

    if (!isInScope(importStatement, inScopeOf, program)) {
      continue
    }

    const importedUri = importToUri(importStatement, document.uri)
    if (!importedUri) {
      continue
    }
    const importedDocument = documents.get(importedUri)
    if (!importedDocument) {
      continue
    }

    const symbols = documentSymbols.get(importedUri)
    let symbol: Extract<SymbolInfo, { type: K }> | undefined = undefined
    if (importStatement.type === "Import") {
      const i = importStatement as ast.Import
      if (i.name.value === name) {
        // TODO: return a symbol containing all symbols from the imported document?
      }
    } else if (importStatement.type === "FromImport") {
      const importedSymbol = (importStatement as ast.FromImport).imports.find(
        (i) => (i.name ?? i.source).value === name
      )
      if (importedSymbol !== undefined) {
        symbol = findSymbolInDocument(
          symbols,
          importedSymbol.source.value,
          type,
          documentASTs.get(importedUri)?.program
        )
      }
    } else {
      symbol = findSymbolInDocument(
        symbols,
        name,
        type,
        documentASTs.get(importedUri)?.program
      )
    }

    if (symbol !== undefined) {
      return [symbol, importedDocument]
    }
  }

  return []
}
