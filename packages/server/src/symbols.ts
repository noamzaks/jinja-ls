import { ast } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { walk } from "./utilities"

export interface SymbolInfo {
  type: "Macro"
  token: ast.TokenNode
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
      token: macroStatement.name.token,
    })
  })
  return result
}

export const argToPython = (arg: ast.Statement, document: TextDocument) => {
  if (arg.type === "Identifier") {
    const identifier = arg as ast.Identifier
    return identifier.token.value
  } else if (arg.type === "KeywordArgumentExpression") {
    const kwarg = arg as ast.KeywordArgumentExpression
    return kwarg.key.token.value
    // TODO: breaks for tuples
    // return `${kwarg.key.token.value} = ${document.getText(
    //   lsp.Range.create(
    //     document.positionAt(kwarg.value.getStart()),
    //     document.positionAt(kwarg.value.getEnd())
    //   )
    // )}`
  }
}
