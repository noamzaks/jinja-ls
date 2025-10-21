import { ast } from "@jinja-ls/language"
import * as lsp from "vscode-languageserver"
import { documentASTs, documentImports, documents } from "./state"

export const getDiagnostics = (uri: string) => {
  const documentAST = documentASTs.get(uri)
  const imports = documentImports.get(uri)
  const parserErrors = documentAST?.parserErrors
  const lexerErrors = documentAST?.lexerErrors

  const items: lsp.Diagnostic[] = []
  const document = documents.get(uri)
  if (document === undefined) {
    return
  }

  for (const e of parserErrors ?? []) {
    if (e instanceof ast.MissingNode) {
      const position = document.positionAt(e.offset)
      items.push({
        message: `Expected ${e.missingType}`,
        range: lsp.Range.create(position, position),
        severity: lsp.DiagnosticSeverity.Error,
      })
    } else if (e instanceof ast.UnexpectedToken) {
      items.push({
        message: e.message,
        range: lsp.Range.create(
          document.positionAt(e.token.start),
          document.positionAt(e.token.end),
        ),
        severity: lsp.DiagnosticSeverity.Error,
      })
    }
  }

  for (const e of lexerErrors ?? []) {
    items.push({
      message: e.message,
      range: lsp.Range.create(
        document.positionAt(e.start),
        document.positionAt(e.end),
      ),
      severity: lsp.DiagnosticSeverity.Error,
    })
  }

  for (const [i, uri] of imports ?? []) {
    if (uri === undefined && i.source instanceof ast.StringLiteral) {
      items.push({
        message: `Couldn't find '${i.source.value}', maybe add to Jinja LS import URIs?`,
        range: lsp.Range.create(
          document.positionAt(i.source.getStart()),
          document.positionAt(i.source.getEnd()),
        ),
        severity: lsp.DiagnosticSeverity.Warning,
      })
    }
  }

  return {
    kind: lsp.DocumentDiagnosticReportKind.Full,
    items,
  } satisfies lsp.DocumentDiagnosticReport
}
