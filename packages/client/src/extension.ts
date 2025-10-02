import * as path from "path"
import * as vscode from "vscode"

import * as lsp from "vscode-languageclient/node"

let client: lsp.LanguageClient

export const activate = (context: vscode.ExtensionContext) => {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"))

  const serverOptions: lsp.ServerOptions = {
    run: { module: serverModule, transport: lsp.TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: lsp.TransportKind.ipc,
    },
  }

  const clientOptions: lsp.LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "jinja" },
      { scheme: "file", language: "jinja-md" },
    ],
  }

  client = new lsp.LanguageClient(
    "jinja-ls",
    "Jinja Language Server",
    serverOptions,
    clientOptions
  )

  client.start()

  client.onRequest("jinja/readFile", async ({ uri }: { uri: string }) => {
    try {
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(uri).fsPath
      )
      return { contents: document.getText() }
    } catch (e) {
      return {}
    }
  })
}

export const deactivate = async () => {
  if (!client) {
    return
  }

  return client.stop()
}
