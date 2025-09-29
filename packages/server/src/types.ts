import { ast, LexerError } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { findSymbol, SymbolInfo } from "./symbols"

export interface ParameterInfo {
  name: string
  default?: string
  type: TypeInfo
}

export interface SignatureInfo {
  arguments?: [ParameterInfo]
  return?: TypeInfo | string
  documentation?: string
}

export interface TypeInfo {
  // If the type is callable, this is its signature.
  name: string
  signature?: SignatureInfo
  properties?: Map<string, TypeInfo | string>
}

export const BUILTIN_TYPES: Record<string, TypeInfo> = {
  str: {
    name: "str",
    properties: new Map([
      [
        "upper",
        {
          name: "upper",
          signature: {
            return: "str",
            documentation:
              "Return a copy of the string converted to uppercase.",
          },
        },
      ],
    ]),
  },
  int: {
    name: "int",
  },
  float: {
    name: "float",
  },
}

export const resolveType = (type: string | TypeInfo | undefined) => {
  if (typeof type === "string") {
    return BUILTIN_TYPES[type]
  }
  return type
}

export const getType = (
  expression: ast.Expression | undefined,
  document: TextDocument,
  documents: Map<string, TextDocument>,
  documentASTs: Map<
    string,
    {
      program?: ast.Program
      lexerErrors?: LexerError[]
      parserErrors?: ast.ErrorNode[]
    }
  >,
  documentSymbols: Map<string, Map<string, SymbolInfo[]>>,
  documentImports: Map<
    string,
    (ast.Include | ast.Import | ast.FromImport | ast.Extends)[]
  >
): TypeInfo | undefined => {
  if (!expression) {
    return
  }

  if (expression.type === "StringLiteral") {
    return resolveType("str")
  } else if (expression.type === "IntegerLiteral") {
    return resolveType("int")
  } else if (expression.type === "FloatLiteral") {
    return resolveType("float")
  } else if (expression.type === "MemberExpression") {
    const memberExpression = expression as ast.MemberExpression
    if (
      memberExpression.property.type === "StringLiteral" ||
      memberExpression.property.type === "Identifier"
    ) {
      const memberType = getType(
        memberExpression.object,
        document,
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )?.properties?.get(
        (memberExpression.property as ast.StringLiteral | ast.Identifier).value
      )
      if (memberType) {
        return resolveType(memberType)
      }
    }
  } else if (expression.type === "Identifier") {
    const [symbol] = findSymbol(
      document,
      expression,
      (expression as ast.Identifier).value,
      "Variable",
      documents,
      documentASTs,
      documentSymbols,
      documentImports
    )
    if (symbol?.token !== undefined && symbol.token.value !== null) {
      return getType(
        symbol.token.value,
        document,
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )
    }
  }
}
