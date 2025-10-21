import { expect } from "expect"
import * as vscode from "vscode"
import { activate, getDocUri } from "./helper"

suite("Should provide document links", () => {
  const libUri = getDocUri("lib.jinja")
  const errorsUri = getDocUri("errors.jinja")

  test("Shows document links in errors.jinja", async () => {
    const links = await getLinks(errorsUri)
    expect(links).toMatchObject([
      {
        range: {
          a: { a: 0, b: 11 },
          b: { a: 0, b: 22 },
        },
        target: libUri,
      },
    ])
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
