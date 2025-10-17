import { isAbsolute } from "path"
import { parse as parseTOML } from "toml"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { URI, Utils } from "vscode-uri"
import { parse as parseYAML } from "yaml"
import { readFile, setGlobals } from "./customRequests"

export const processLSCommand = async (
  connection: lsp.Connection,
  document: TextDocument,
  command: string,
) => {
  const [commandName, ...args] = command.split(" ")
  if (commandName === "globals") {
    const documentUri = URI.parse(document.uri)
    for (const globalsPath of args) {
      const uri = isAbsolute(globalsPath)
        ? documentUri.with({ path: globalsPath }).toString()
        : Utils.joinPath(documentUri, "..", globalsPath).toString()
      const contents = await readFile(connection, uri)
      if (contents === undefined) {
        continue
      }

      if (globalsPath.endsWith(".json")) {
        setGlobals(JSON.parse(contents), document.uri)
      } else if (
        globalsPath.endsWith(".yaml") ||
        globalsPath.endsWith(".yml")
      ) {
        setGlobals(parseYAML(contents), document.uri)
      } else if (globalsPath.endsWith(".toml")) {
        setGlobals(parseTOML(contents), document.uri)
      }
    }
  }
}
