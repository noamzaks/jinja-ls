import { ast, formatExpression } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { walk } from "./utilities"

export interface SymbolInfo {
  type: "Macro"
  token: ast.Macro
}

export const getSymbols = (program: ast.Program) => {
  const result = new Map<string, SymbolInfo>()
  walk(program, (statement) => {
    if (statement.type !== "Macro") {
      return
    }
    const macroStatement = statement as ast.Macro
    result.set(macroStatement.name.value, {
      type: "Macro",
      token: macroStatement,
    })
  })
  return result
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
