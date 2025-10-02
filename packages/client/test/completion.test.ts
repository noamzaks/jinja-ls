import { expect } from "expect"
import * as vscode from "vscode"
import { activate, getDocUri } from "./helper"

suite("Should provide completions", () => {
  const libUri = getDocUri("lib.jinja")
  const errorsUri = getDocUri("errors.jinja")

  test("Returns completions for errors.jinja", async () => {
    expect(
      await getCompletions(errorsUri, new vscode.Position(20, 8), "u"),
    ).toMatchObject([
      {
        label: "unique",
        kind: "Function",
      },
      {
        label: "upper",
        kind: "Function",
      },
      {
        label: "urlencode",
        kind: "Function",
      },
      {
        label: "urlize",
        kind: "Function",
      },
    ])

    expect(
      await getCompletions(errorsUri, new vscode.Position(21, 9), "o"),
    ).toMatchObject([
      {
        label: "odd",
        kind: "Function",
      },
    ])

    expect(
      await getCompletions(errorsUri, new vscode.Position(23, 11)),
    ).toMatchObject([
      {
        label: "arguments",
        kind: "Property",
      },
      {
        label: "caller",
        kind: "Property",
      },
      {
        label: "catch_kwargs",
        kind: "Property",
      },
      {
        label: "catch_varargs",
        kind: "Property",
      },
      {
        label: "name",
        kind: "Property",
      },
    ])
  })
})

export const getCompletions = async (
  uri: vscode.Uri,
  position: vscode.Position,
  startingWith: string = "",
) => {
  await activate(uri)
  const completions: vscode.CompletionList =
    await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      uri,
      position,
    )
  return completions.items
    .map((item) => JSON.parse(JSON.stringify(item)))
    .filter((item) => item.label.startsWith(startingWith))
}
