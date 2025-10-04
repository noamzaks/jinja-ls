import { ast, formatExpression } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { BUILTIN_TYPES } from "./builtinTypes"
import { findSymbol } from "./symbols"

export interface ArgumentInfo {
  name: string
  default?: string
  type?: TypeInfo | TypeReference | string
}

export interface SignatureInfo {
  arguments?: ArgumentInfo[]
  return?: TypeInfo | TypeReference | string
  documentation?: string
}

export interface TypeInfo {
  // If the type is callable, this is its signature.
  name: string
  signature?: SignatureInfo
  properties?: Record<string, TypeInfo | string | TypeReference | undefined>
  // If the value is known
  literalValue?: string
  documentation?: string
}

export interface TypeReference {
  // Should be in BUILTIN_TYPES
  type: string
  literalValue?: string
  documentation?: string
}

export const resolveType = (
  type: string | TypeInfo | TypeReference | undefined,
) => {
  if (typeof type === "string") {
    return BUILTIN_TYPES[type] ?? { name: type }
  }
  // @ts-ignore
  if (type?.type) {
    // @ts-ignore
    return BUILTIN_TYPES[type.type]
  }
  return type as TypeInfo | undefined
}

export const getType = (
  expression: ast.Expression | undefined | null,
  document: TextDocument,
): TypeInfo | TypeReference | undefined => {
  if (!expression) {
    return
  }

  if (expression instanceof ast.StringLiteral) {
    return { type: "str", literalValue: formatExpression(expression) }
  } else if (expression instanceof ast.IntegerLiteral) {
    return { type: "int", literalValue: formatExpression(expression) }
  } else if (expression instanceof ast.FloatLiteral) {
    return { type: "float", literalValue: formatExpression(expression) }
  } else if (
    expression instanceof ast.ArrayLiteral ||
    expression instanceof ast.TupleLiteral
  ) {
    return {
      name: expression.type === "ArrayLiteral" ? "list" : "tuple",
      properties: Object.fromEntries(
        expression.value.map((expression, index) => [
          index.toString(),
          getType(expression, document),
        ]),
      ),
      literalValue: formatExpression(expression),
    }
  } else if (expression instanceof ast.ObjectLiteral) {
    const properties: Record<
      string,
      TypeInfo | TypeReference | string | undefined
    > = {}
    for (const [key, value] of expression.value.entries()) {
      if (key instanceof ast.StringLiteral) {
        properties[key.value] = getType(value, document)
      }
    }
    return {
      name: "dict",
      properties,
      literalValue: formatExpression(expression),
    }
  } else if (expression instanceof ast.MemberExpression) {
    if (
      expression.property instanceof ast.StringLiteral ||
      expression.property instanceof ast.Identifier ||
      expression.property instanceof ast.IntegerLiteral
    ) {
      const objectType = resolveType(getType(expression.object, document))
      let propertyName = expression.property.value
      if (typeof propertyName === "number" && propertyName < 0) {
        propertyName =
          Object.keys(objectType?.properties ?? {}).length + propertyName
      }
      const memberType = (objectType?.properties ?? {})[propertyName.toString()]
      if (memberType !== undefined) {
        if (typeof memberType === "string") {
          return resolveType(memberType)
        }
        return memberType
      }
    }
  } else if (expression instanceof ast.CallExpression) {
    const calleeType = resolveType(getType(expression.callee, document))
    if (calleeType?.signature !== undefined) {
      return resolveType(calleeType.signature.return)
    }
  } else if (expression instanceof ast.Identifier) {
    const [symbol, symbolDocument] = findSymbol(
      document,
      expression,
      expression.value,
      "Variable",
    )
    if (symbol !== undefined && symbolDocument !== undefined) {
      return symbol.getType(symbolDocument)
    }
  }
}

export const argumentToString = (argument: ArgumentInfo) => {
  let result = argument.name

  const typename = resolveType(argument.type)?.name
  if (typename !== undefined) {
    result += ": " + typename
  }

  if (argument.default !== undefined) {
    result += " = " + argument.default
  }

  return result
}

export const stringifySignatureInfo = (s: SignatureInfo) => {
  let signature = `(${s.arguments?.map(argumentToString).join(", ") ?? ""})`
  const returnName = resolveType(s.return)?.name
  if (returnName) {
    signature += " -> " + returnName
  }
  return signature
}
