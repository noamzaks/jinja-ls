import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { URI } from "vscode-uri"
import { configuration, rootURIs } from "../src/state"
import { getTemplateRootURIs } from "../src/symbols"

describe("getTemplateRootURIs", () => {
  let originalRootURIs: URI[]
  let originalTemplateRoots: typeof configuration.templateRoots
  let hadTemplateRoots: boolean

  beforeEach(() => {
    originalRootURIs = [...rootURIs]
    originalTemplateRoots = configuration.templateRoots
    hadTemplateRoots = Object.hasOwn(configuration, "templateRoots")
    rootURIs.splice(0)
    delete configuration.templateRoots
  })

  afterEach(() => {
    rootURIs.splice(0, rootURIs.length, ...originalRootURIs)
    if (hadTemplateRoots) {
      configuration.templateRoots = originalTemplateRoots
    } else {
      delete configuration.templateRoots
    }
  })

  it("uses workspace roots when templateRoots is not configured", () => {
    rootURIs.push(
      URI.parse("file:///workspace/a"),
      URI.parse("file:///workspace/b"),
    )

    expect(getTemplateRootURIs()).toEqual([
      URI.parse("file:///workspace/a"),
      URI.parse("file:///workspace/b"),
    ])
  })

  it("uses workspace roots when templateRoots is empty", () => {
    rootURIs.push(
      URI.parse("file:///workspace/a"),
      URI.parse("file:///workspace/b"),
    )
    configuration.templateRoots = []

    expect(getTemplateRootURIs()).toEqual([
      URI.parse("file:///workspace/a"),
      URI.parse("file:///workspace/b"),
    ])
  })

  it.each([undefined, [], ["templates"]])(
    "returns no roots without a workspace when templateRoots is %j",
    (templateRoots) => {
      configuration.templateRoots = templateRoots

      expect(getTemplateRootURIs()).toEqual([])
    },
  )

  it("resolves a template directory relative to the workspace", () => {
    rootURIs.push(URI.parse("file:///workspace/project"))
    configuration.templateRoots = ["src/templates"]

    expect(getTemplateRootURIs()).toEqual([
      URI.parse("file:///workspace/project/src/templates"),
    ])
  })

  it("resolves every template root in every workspace in configured order", () => {
    rootURIs.push(
      URI.parse("file:///workspace/a"),
      URI.parse("file:///workspace/b"),
    )
    configuration.templateRoots = ["templates", "views"]

    expect(getTemplateRootURIs()).toEqual([
      URI.parse("file:///workspace/a/templates"),
      URI.parse("file:///workspace/a/views"),
      URI.parse("file:///workspace/b/templates"),
      URI.parse("file:///workspace/b/views"),
    ])
    expect(rootURIs).toEqual([
      URI.parse("file:///workspace/a"),
      URI.parse("file:///workspace/b"),
    ])
    expect(configuration.templateRoots).toEqual(["templates", "views"])
  })

  it("normalizes relative path segments and trailing workspace slashes", () => {
    rootURIs.push(URI.parse("file:///workspace/project/"))
    configuration.templateRoots = [".", "./src/../templates", "../shared"]

    expect(getTemplateRootURIs()).toEqual([
      URI.parse("file:///workspace/project"),
      URI.parse("file:///workspace/project/templates"),
      URI.parse("file:///workspace/shared"),
    ])
  })

  it("preserves remote workspace schemes and authorities and encodes spaces", () => {
    rootURIs.push(
      URI.parse("vscode-remote://ssh-remote+host/workspace/project"),
    )
    configuration.templateRoots = ["shared templates"]

    expect(getTemplateRootURIs()).toEqual([
      URI.parse(
        "vscode-remote://ssh-remote+host/workspace/project/shared%20templates",
      ),
    ])
  })
})
