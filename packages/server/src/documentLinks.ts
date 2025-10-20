import * as lsp from "vscode-languageserver"
import { documentImports, documents } from "./state"
import { rangeOf } from "./utilities"

export const getDocumentLinks = (uri: string) => {
  const result: lsp.DocumentLink[] = []

  const document = documents.get(uri)
  const imports = documentImports.get(uri)

  if (!document || !imports) {
    return
  }

  for (const [statement, uri] of imports) {
    if (uri !== undefined) {
      result.push({
        target: uri,
        range: rangeOf(document, statement.source),
      })
    }
  }

  return result
}
