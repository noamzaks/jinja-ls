import { expect } from "expect"
import * as vscode from "vscode"
import { activate, getDocUri } from "./helper"

suite("Should provide document links", () => {
  const libUri = getDocUri("lib.jinja")
  const errorsUri = getDocUri("errors.jinja")

  test("Shows document links in errors.jinja", async () => {
    const links = await getLinks(errorsUri)
    expect(
      links.map((link) => ({
        start: [link.range.start.line, link.range.start.character],
        end: [link.range.end.line, link.range.end.character],
        target: link.target?.toString(),
      })),
    ).toEqual([{ start: [0, 11], end: [0, 22], target: libUri.toString() }])
  })
})

const getLinks = async (docUri: vscode.Uri) => {
  await activate(docUri)
  const links: vscode.DocumentLink[] = await vscode.commands.executeCommand(
    "vscode.executeLinkProvider",
    docUri,
  )
  return links
}
