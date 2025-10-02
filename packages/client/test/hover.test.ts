import { expect } from "expect"
import * as vscode from "vscode"
import { activate, getDocUri, rangeToJson } from "./helper"

suite("Should provide hover", () => {
  const errorsUri = getDocUri("errors.jinja")

  test("Returns hover information for errors.jinja", async () => {
    expect(
      await getHover(errorsUri, new vscode.Position(27, 15)),
    ).toMatchObject({
      contents: ["```python\n(start: int, stop: int, step: int) -> range\n```"],
      range: [
        { character: 12, line: 27 },
        { character: 17, line: 27 },
      ],
    })

    expect(await getHover(errorsUri, new vscode.Position(23, 6))).toMatchObject(
      {
        contents: ["```python\nexample: macro\n```"],
        range: [
          { character: 3, line: 23 },
          { character: 10, line: 23 },
        ],
      },
    )
  })
})

export const getHover = async (uri: vscode.Uri, position: vscode.Position) => {
  await activate(uri)
  const hovers: vscode.Hover[] = await vscode.commands.executeCommand(
    "vscode.executeHoverProvider",
    uri,
    position,
  )
  expect(hovers.length).toEqual(1)
  const hover = hovers[0]
  return {
    // @ts-ignore
    contents: hover.contents.map((c) => ((c.value ?? c) as string).trim()),
    range: rangeToJson(hover.range),
  }
}
