import { expect } from "expect"
import * as vscode from "vscode"
import { activate, getDocUri } from "./helper"

suite("Should provide completions", () => {
  const errorsUri = getDocUri("errors.jinja")

  test("Returns completions for errors.jinja", async () => {
    expect(
      await getCompletions(errorsUri, new vscode.Position(17, 6), "u"),
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
      await getCompletions(errorsUri, new vscode.Position(18, 7), "o"),
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

    expect(
      await getCompletions(errorsUri, new vscode.Position(32, 9)),
    ).toMatchObject([{ label: "head", kind: "Function" }])

    expect(
      await getCompletions(errorsUri, new vscode.Position(34, 12)),
    ).toMatchObject([
      { label: "errors.jinja", kind: "File" },
      { label: "free", kind: "Folder" },
      { label: "hola.jinja2", kind: "File" },
      { label: "lib.jinja", kind: "File" },
      { label: "somewhere", kind: "Folder" },
    ])

    expect(
      await getCompletions(errorsUri, new vscode.Position(35, 22)),
    ).toMatchObject([{ label: "hi.j2", kind: "File" }])
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
    .filter((item) =>
      (item.label?.label ?? item.label).startsWith(startingWith),
    )
}
