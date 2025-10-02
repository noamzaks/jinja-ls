import * as path from "path"
import * as vscode from "vscode"

export let doc: vscode.TextDocument
export let editor: vscode.TextEditor
export let documentEol: string
export let platformEol: string

/**
 * Activates the vscode.lsp-sample extension
 */
export async function activate(docUri: vscode.Uri) {
  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension("noamzaks.jinja-ls")!
  await ext.activate()
  try {
    doc = await vscode.workspace.openTextDocument(docUri)
    editor = await vscode.window.showTextDocument(doc)
    await sleep(2000) // Wait for server activation
  } catch (e) {
    console.error(e)
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const getDocPath = (p: string) => {
  return path.resolve(__dirname, "..", "..", "packages", "client", "fixture", p)
}

export const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p))
}
