import $RefParser from "@apidevtools/json-schema-ref-parser"
import { isAbsolute } from "path"
import { parse as parseTOML } from "toml"
import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { URI, Utils } from "vscode-uri"
import { parse as parseYAML } from "yaml"
import { readUri, setGlobals } from "./customRequests"
import { TypeInfo, TypeReference } from "./types"

export const processLSCommand = async (
  connection: lsp.Connection,
  document: TextDocument,
  command: string,
) => {
  const [commandName, ...args] = command.split(" ")
  if (commandName === "globals") {
    const documentUri = URI.parse(document.uri)
    for (const globalsPath of args) {
      let uri: string
      if (
        globalsPath.startsWith("http://") ||
        globalsPath.startsWith("https://")
      ) {
        uri = globalsPath
      } else if (isAbsolute(globalsPath)) {
        uri = documentUri.with({ path: globalsPath }).toString()
      } else {
        uri = Utils.joinPath(documentUri, "..", globalsPath).toString()
      }
      const contents = await readUri(connection, uri)
      if (contents === undefined) {
        continue
      }

      if (globalsPath.endsWith(".json")) {
        const contentsObject = JSON.parse(contents)
        if (
          contentsObject["$schema"] ===
            "http://json-schema.org/draft-07/schema#" &&
          contentsObject["$id"] !== undefined
        ) {
          try {
            setGlobals(await schemaToGlobals(contentsObject), document.uri)
          } catch (e) {
            console.log(e)
          }
        } else {
          setGlobals(contentsObject, document.uri)
        }
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

export const schemaPropertyToInfo = (
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  property: any,
): string | TypeInfo | TypeReference => {
  name = property?.title ?? name
  const documentation = property?.description
  if (property.type === "string") {
    return { type: "str", documentation }
  } else if (property.type === "number") {
    return { type: "float", documentation }
  } else if (property.type === "boolean") {
    return { type: "bool", documentation }
  } else if (property.type === "null") {
    return "None"
  } else if (property.type === "array") {
    return {
      name,
      elementType: schemaPropertyToInfo(name + "Item", property?.items),
      documentation,
    }
  } else if (property.type === "object") {
    const properties: Record<string, string | TypeInfo | TypeReference> = {}
    for (const p in property?.properties ?? {}) {
      properties[p] = schemaPropertyToInfo(p, property.properties[p])
    }
    return { name, properties, documentation }
  } else if (property.anyOf || property.oneOf) {
    const items = property.anyOf || property.oneOf
    return {
      type: "Union",
      types: items.map((item, index) =>
        schemaPropertyToInfo(`${name}${index}`, item),
      ),
      documentation,
    }
  }
  return { name: "Any", documentation }
}

export const schemaToGlobals = async (
  contents: object,
): Promise<Record<string, unknown>> => {
  const resolver = new $RefParser()
  const result = await resolver.dereference(contents)
  const globals: Record<string, unknown> = {}
  for (const property in result.properties ?? {}) {
    globals[property] = {
      "x-jinja-ls-type": schemaPropertyToInfo(
        property,
        result.properties[property],
      ),
    }
  }
  return globals
}
