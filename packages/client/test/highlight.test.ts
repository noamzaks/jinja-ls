import { expect } from "expect"
import * as vscode from "vscode"
import { activate, getDocUri } from "./helper"

suite("Should provide file details", () => {
  const libUri = getDocUri("lib.jinja")
  const errorsUri = getDocUri("errors.jinja")

  test("Highlights lib.jinja", async () => {
    const resolvedTokens = await getTokens(libUri)
    expect(resolvedTokens).toEqual([
      { start: 3, end: 8, tokenType: "keyword" },
      { start: 9, end: 16, tokenType: "function" },
      {
        start: 17,
        end: 26,
        tokenType: "variable",
      },
      {
        start: 27,
        end: 38,
        tokenType: "string",
      },
      {
        start: 40,
        end: 47,
        tokenType: "variable",
      },
      {
        start: 48,
        end: 52,
        tokenType: "macro",
      },
      {
        start: 54,
        end: 58,
        tokenType: "variable",
      },
      {
        start: 59,
        end: 63,
        tokenType: "number",
      },
      {
        start: 71,
        end: 79,
        tokenType: "keyword",
      },
      {
        start: 86,
        end: 91,
        tokenType: "keyword",
      },
      {
        start: 103,
        end: 111,
        tokenType: "keyword",
      },
    ])
  })

  test("Highlights the end of errors.jinja", async () => {
    const resolvedTokens = await getTokens(errorsUri)
    const expectedTokens = [
      { start: 342, end: 345, tokenType: "keyword" },
      { start: 346, end: 347, tokenType: "variable" },
      { start: 348, end: 350, tokenType: "keyword" },
      { start: 351, end: 356, tokenType: "function" },
      { start: 357, end: 358, tokenType: "number" },
    ]
    for (const token of expectedTokens) {
      expect(resolvedTokens).toContainEqual(token)
    }
  })
})

const getTokens = async (docUri: vscode.Uri) => {
  await activate(docUri)
  const document = await vscode.workspace.openTextDocument(docUri)
  const legend = (await vscode.commands.executeCommand(
    "vscode.provideDocumentSemanticTokensLegend",
    docUri,
  )) as vscode.SemanticTokensLegend
  const tokens = (await vscode.commands.executeCommand(
    "vscode.provideDocumentSemanticTokens",
    docUri,
  )) as vscode.SemanticTokens
  const resolvedTokens = []
  let previousLine = 0
  let previousCharacter = 0
  for (let i = 0; i < tokens.data.length; i += 5) {
    const lineDelta = tokens.data[i]
    const characterDelta = tokens.data[i + 1]
    const currentLine = previousLine + lineDelta
    const currentCharacter =
      currentLine === previousLine
        ? previousCharacter + characterDelta
        : characterDelta
    const start = document.offsetAt(
      new vscode.Position(currentLine, currentCharacter),
    )
    previousLine = currentLine
    previousCharacter = currentCharacter
    resolvedTokens.push({
      start,
      end: start + tokens.data[i + 2],
      tokenType: legend.tokenTypes[tokens.data[i + 3]],
    })
  }
  return resolvedTokens
}
