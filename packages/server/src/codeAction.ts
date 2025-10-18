import * as lsp from "vscode-languageserver"

export const getCodeAction = (uri: string, diagnostics: lsp.Diagnostic[]) => {
  const result: lsp.CodeAction[] = []
  for (const diagnostic of diagnostics) {
    if (diagnostic.message.startsWith("Expected '")) {
      const slice = diagnostic.message.slice("Expected '".length)
      const expected = slice.slice(0, slice.indexOf("'"))
      result.push({
        title: `Add ${expected}`,
        kind: lsp.CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [uri]: [lsp.TextEdit.insert(diagnostic.range.end, expected)],
          },
        },
      })
    }
  }
  return result
}
