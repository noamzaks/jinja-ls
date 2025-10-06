import * as path from "path"
import * as vscode from "vscode"

import * as lsp from "vscode-languageclient/node"

let client: lsp.LanguageClient

const SetGlobalsRequest = new lsp.RequestType<
  { globals: Record<string, unknown>; uri: string | undefined; merge: boolean },
  { success: boolean },
  void
>("jinja/setGlobals")

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
      { scheme: "file", language: "jinja-html" },
      { scheme: "file", language: "jinja-xml" },
      { scheme: "file", language: "jinja-css" },
      { scheme: "file", language: "jinja-json" },
      { scheme: "file", language: "jinja-md" },
      { scheme: "file", language: "jinja-yaml" },
      { scheme: "file", language: "jinja-toml" },
      { scheme: "file", language: "jinja-lua" },
      { scheme: "file", language: "jinja-properties" },
      { scheme: "file", language: "jinja-shell" },
      { scheme: "file", language: "jinja-dockerfile" },
      { scheme: "file", language: "jinja-sql" },
      { scheme: "file", language: "jinja-py" },
      { scheme: "file", language: "jinja-cy" },
      { scheme: "file", language: "jinja-terraform" },
      { scheme: "file", language: "jinja-nginx" },
      { scheme: "file", language: "jinja-groovy" },
      { scheme: "file", language: "jinja-systemd" },
      { scheme: "file", language: "jinja-cpp" },
      { scheme: "file", language: "jinja-java" },
      { scheme: "file", language: "jinja-js" },
      { scheme: "file", language: "jinja-ts" },
      { scheme: "file", language: "jinja-php" },
      { scheme: "file", language: "jinja-cisco" },
      { scheme: "file", language: "jinja-rust" },
    ],
  }

  client = new lsp.LanguageClient(
    "jinja-ls",
    "Jinja Language Server",
    serverOptions,
    clientOptions,
  )

  client.onRequest("jinja/readFile", async ({ uri }: { uri: string }) => {
    try {
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(uri).fsPath,
      )
      return { contents: document.getText() }
    } catch {
      return {}
    }
  })

  client.start()

  context.subscriptions.push(
    vscode.commands.registerCommand("jinja-ls.restart", () => client.restart()),
    vscode.commands.registerCommand(
      "jinja-ls.setGlobals",
      (globals: Record<string, unknown>, uri?: string, merge = true) =>
        client.sendRequest(SetGlobalsRequest, { globals, uri, merge }),
    ),
  )
}

export const deactivate = async () => {
  if (!client) {
    return
  }

  return client.stop()
}
