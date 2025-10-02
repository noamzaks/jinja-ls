import { expect } from "expect"
import * as vscode from "vscode"
import { activate, getDocUri } from "./helper"

suite("Should provide go to definition", () => {
  const libUri = getDocUri("lib.jinja")
  const errorsUri = getDocUri("errors.jinja")

  test("Returns definitions for errors.jinja", async () => {
    expect(await getDefinition(errorsUri, new vscode.Position(29, 7))).toEqual({
      uri: errorsUri.toString(),
      range: { start: 346, end: 347 },
    })

    expect(await getDefinition(errorsUri, new vscode.Position(23, 3))).toEqual({
      uri: libUri.toString(),
      range: { start: 9, end: 16 },
    })
  })
})

export const getDefinition = async (
  uri: vscode.Uri,
  position: vscode.Position,
) => {
  await activate(uri)
  const locations: (vscode.Location | vscode.LocationLink)[] =
    await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      uri,
      position,
    )
  expect(locations.length).toEqual(1)
  const location = locations[0]
  if (location instanceof vscode.Location) {
    const document = await vscode.workspace.openTextDocument(location.uri)
    return {
      uri: location.uri.toString(),
      range: {
        start: document.offsetAt(location.range.start),
        end: document.offsetAt(location.range.end),
      },
    }
  } else {
    const document = await vscode.workspace.openTextDocument(location.targetUri)
    return {
      uri: location.targetUri.toString(),
      range: {
        start: document.offsetAt(location.targetRange.start),
        end: document.offsetAt(location.targetRange.end),
      },
    }
  }
}
