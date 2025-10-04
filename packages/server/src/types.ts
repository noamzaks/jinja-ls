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

  if (expression.type === "StringLiteral") {
    return { type: "str", literalValue: formatExpression(expression) }
  } else if (expression.type === "IntegerLiteral") {
    return { type: "int", literalValue: formatExpression(expression) }
  } else if (expression.type === "FloatLiteral") {
    return { type: "float", literalValue: formatExpression(expression) }
  } else if (
    expression.type === "ArrayLiteral" ||
    expression.type === "TupleLiteral"
  ) {
    const arrayOrTuple = expression as ast.ArrayLiteral | ast.TupleLiteral
    return {
      name: expression.type === "ArrayLiteral" ? "list" : "tuple",
      properties: Object.fromEntries(
        arrayOrTuple.value.map((expression, index) => [
          index.toString(),
          getType(expression, document),
        ]),
      ),
      literalValue: formatExpression(expression),
    }
  } else if (expression.type === "ObjectLiteral") {
    const objectLiteral = expression as ast.ObjectLiteral
    const properties: Record<
      string,
      TypeInfo | TypeReference | string | undefined
    > = {}
    for (const [key, value] of objectLiteral.value.entries()) {
      if (key.type === "StringLiteral") {
        properties[(key as ast.StringLiteral).value] = getType(value, document)
      }
    }
    return {
      name: "dict",
      properties,
      literalValue: formatExpression(objectLiteral),
    }
  } else if (expression.type === "MemberExpression") {
    const memberExpression = expression as ast.MemberExpression
    if (
      memberExpression.property.type === "StringLiteral" ||
      memberExpression.property.type === "Identifier" ||
      memberExpression.property.type === "IntegerLiteral"
    ) {
      const objectType = resolveType(getType(memberExpression.object, document))
      let propertyName = (
        memberExpression.property as
          | ast.StringLiteral
          | ast.Identifier
          | ast.IntegerLiteral
      ).value
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
  } else if (expression.type === "CallExpression") {
    const callExpression = expression as ast.CallExpression
    const calleeType = resolveType(getType(callExpression.callee, document))
    if (calleeType?.signature !== undefined) {
      return resolveType(calleeType.signature.return)
    }
  } else if (expression.type === "Identifier") {
    const [symbol, symbolDocument] = findSymbol(
      document,
      expression,
      (expression as ast.Identifier).value,
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
