import { expect } from "expect"
import * as vscode from "vscode"
import { activate, getDocUri } from "./helper"

suite("Should provide file diagnostics", () => {
  const errorsUri = getDocUri("errors.jinja")

  test("Returns diagnostics for errors.jinja", async () => {
    await activate(errorsUri)
    const document = await vscode.workspace.openTextDocument(errorsUri)
    const diagnostics = vscode.languages.getDiagnostics(errorsUri)
    const resolvedDiagnostics = diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity,
      message: diagnostic.message,
      start: document.offsetAt(diagnostic.range.start),
      end: document.offsetAt(diagnostic.range.end),
    }))

    expect(resolvedDiagnostics).toMatchObject([
      {
        severity: 0,
        message: "Expected statement name",
        start: 30,
        end: 30,
      },
      { severity: 0, message: "Expected expression", start: 37, end: 37 },
      { severity: 0, message: "Expected expression", start: 46, end: 46 },
      {
        severity: 0,
        message: "Expected identifier/tuple for the loop variable",
        start: 56,
        end: 56,
      },
      {
        severity: 0,
        message: "Expected identifier/tuple for the loop variable",
        start: 66,
        end: 66,
      },
      {
        severity: 0,
        message: "Expected identifier/tuple for the loop variable",
        start: 79,
        end: 79,
      },
      { severity: 0, message: "Expected expression", start: 97, end: 97 },
      {
        severity: 0,
        message: "Expected 'in' keyword following loop variable",
        start: 109,
        end: 109,
      },
      { severity: 0, message: "Expected macro name", start: 124, end: 124 },
      { severity: 0, message: "Expected macro name", start: 136, end: 136 },
      { severity: 0, message: "Expected '%}'", start: 156, end: 156 },
      { severity: 0, message: "Expected statement", start: 156, end: 156 },
      { severity: 0, message: "Expected statement", start: 161, end: 161 },
      {
        severity: 0,
        message: "Unexpected statement 'invalid'",
        start: 167,
        end: 174,
      },
      { severity: 0, message: "Expected statement", start: 167, end: 167 },
      { severity: 0, message: "Expected statement", start: 175, end: 175 },
      {
        severity: 0,
        message: "Expected identifier for the filter",
        start: 239,
        end: 239,
      },
      {
        severity: 0,
        message: "Expected identifier for the test",
        start: 251,
        end: 251,
      },
      {
        severity: 0,
        message: "Expected identifier for member expression",
        start: 302,
        end: 302,
      },
      {
        severity: 0,
        message: "Expected identifier for member expression",
        start: 313,
        end: 313,
      },
      {
        severity: 0,
        message: "Expected identifier for member expression",
        start: 326,
        end: 326,
      },
      {
        severity: 0,
        message: "Expected identifier for member expression",
        start: 336,
        end: 336,
      },
      { severity: 0, message: "Expected expression", start: 371, end: 371 },
      { severity: 0, message: "Expected identifier", start: 410, end: 410 },
      {
        severity: 1,
        message: "Couldn't find '', maybe add to Jinja LS import URIs?",
        start: 439,
        end: 441,
      },
      {
        severity: 1,
        message:
          "Couldn't find 'somewhere/', maybe add to Jinja LS import URIs?",
        start: 456,
        end: 468,
      },
    ])
  })
})
