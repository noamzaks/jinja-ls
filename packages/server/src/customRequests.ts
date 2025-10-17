import * as lsp from "vscode-languageserver"
import { documentGlobals, globals } from "./state"

// Requests from the client

export const ReadFileRequest = new lsp.RequestType<
  { uri: string },
  { contents: string | undefined },
  void
>("jinja/readFile")

export const readFile = async (
  connection: lsp.Connection,
  uri: string,
): Promise<string | undefined> =>
  (await connection.sendRequest(ReadFileRequest, { uri }))?.contents

// Requests from the server

export const setGlobals = (
  globalsToAdd: Record<string, unknown>,
  uri?: string,
  merge = true,
) => {
  let g = globals
  if (uri !== undefined) {
    if (!documentGlobals[uri]) {
      documentGlobals[uri] = {}
    }
    g = documentGlobals[uri]
  }
  if (!merge) {
    for (const key in globals) {
      delete g[key]
    }
  }

  for (const key in globalsToAdd) {
    g[key] = globalsToAdd[key]
  }
}

export const registerCustomCommands = (connection: lsp.Connection) => {
  connection.onRequest(
    "jinja/setGlobals",
    async ({
      globals: globalsToAdd,
      uri,
      merge,
    }: {
      globals: Record<string, unknown>
      uri: string | undefined
      merge: boolean
    }) => {
      setGlobals(globalsToAdd, uri, merge)

      return { success: true }
    },
  )
}
