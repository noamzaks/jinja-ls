import * as path from "path"

import { runTests } from "@vscode/test-electron"

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "..", "..")

    const extensionTestsPath = __dirname

    const workspacePath = path.resolve(
      __dirname,
      "..",
      "..",
      "packages",
      "client",
      "fixture",
    )

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspacePath],
    })
  } catch {
    console.error("Failed to run tests")
    process.exit(1)
  }
}

main()
