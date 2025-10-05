import { ast, formatExpression } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { BUILTIN_TYPES } from "./builtinTypes"
import { BUILTIN_FILTERS } from "./constants"
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
  args?: string
  kwargs?: string
}

export interface TypeInfo {
  type?: undefined
  // If the type is callable, this is its signature.
  name: string
  signature?: SignatureInfo
  // For iterables, this is the type of the elements
  elementType?: TypeInfo | TypeReference | string
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
): TypeInfo | undefined => {
  if (typeof type === "string") {
    return BUILTIN_TYPES[type] ?? { name: type }
  }
  if (type?.type) {
    return BUILTIN_TYPES[type.type]
  }
  return type as TypeInfo | undefined
}

export const getElementType = (types: (TypeInfo | TypeReference)[]) => {
  let elementType: TypeInfo | undefined = undefined
  const firstType = resolveType(types[0])
  if (
    types.length !== 0 &&
    types.every((p) => resolveType(p).name === firstType.name)
  ) {
    elementType = firstType
    if (elementType.literalValue) {
      delete elementType.literalValue
    }
    return elementType
  }
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
    const properties = Object.fromEntries(
      expression.value.map((expression, index) => [
        index.toString(),
        getType(expression, document),
      ]),
    )
    return {
      name: expression.type === "ArrayLiteral" ? "list" : "tuple",
      properties,
      literalValue: formatExpression(expression),
      elementType: getElementType(Object.values(properties)),
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
  } else if (expression instanceof ast.BinaryExpression) {
    const rightType = resolveType(getType(expression.right, document))
    const leftType = resolveType(getType(expression.left, document))
    if (expression.operator.value === "~") {
      return resolveType("str")
    } else if (
      ["int", "float"].includes(leftType?.name) &&
      ["int", "float"].includes(rightType?.name)
    ) {
      if (expression.operator.value === "/") {
        return resolveType("float")
      } else if (expression.operator.value === "//") {
        return resolveType("int")
      } else if (leftType.name === "float" || rightType.name === "float") {
        return resolveType("float")
      } else {
        return resolveType("int")
      }
    } else if (
      expression.operator.value === "*" &&
      leftType?.name === "str" &&
      rightType?.name === "int"
    ) {
      return leftType
    } else if (
      ["and", "or", "not", "==", "!=", ">", ">=", "<", "<="].includes(
        expression.operator.value,
      )
    ) {
      return resolveType("bool")
    }
  } else if (expression instanceof ast.UnaryExpression) {
    if (expression.operator.value === "not") {
      return resolveType("bool")
    }
  } else if (expression instanceof ast.FilterExpression) {
    return resolveType(
      BUILTIN_FILTERS[expression.filter.identifierName]?.signature?.return,
    )
  } else if (expression instanceof ast.TestExpression) {
    return resolveType("bool")
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
  const args = s.arguments ?? []
  if (s.args !== undefined) {
    args.push({ name: "*" + s.args })
  }
  if (s.kwargs !== undefined) {
    args.push({ name: "**" + s.kwargs })
  }
  let signature = `(${args.length !== 0 ? args.map(argumentToString).join(", ") : ""})`
  const returnName = resolveType(s.return)?.name
  if (returnName) {
    signature += " -> " + returnName
  }
  return signature
}

export const getTypeInfoFromJS = (
  value: unknown,
): TypeInfo | TypeReference | undefined => {
  if (typeof value === "string") {
    return { type: "str", literalValue: JSON.stringify(value) }
  } else if (typeof value === "number" || typeof value === "bigint") {
    return {
      type: Number.isInteger(value) ? "int" : "float",
      literalValue: value.toString(),
    }
  } else if (typeof value === "boolean") {
    return { type: "bool", literalValue: value ? "true" : "false" }
  } else if (Array.isArray(value)) {
    const properties = Object.fromEntries(
      value.map((item, index) => [index.toString(), getTypeInfoFromJS(item)]),
    )
    return {
      name: "tuple",
      properties,
      literalValue: JSON.stringify(value),
      elementType: getElementType(Object.values(properties)),
    }
  } else if (typeof value === "object") {
    return {
      name: "dict",
      literalValue: JSON.stringify(value),
      properties: Object.fromEntries(
        Object.entries(value).map(([key, value]) => [
          key,
          getTypeInfoFromJS(value),
        ]),
      ),
    }
  }
}
