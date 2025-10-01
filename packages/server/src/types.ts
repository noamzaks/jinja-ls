import { ast, LexerError } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { BUILTIN_TYPES } from "./builtinTypes"
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
  properties?: Record<string, TypeInfo | string | undefined>
}

export const resolveType = (type: string | TypeInfo | undefined) => {
  if (typeof type === "string") {
    return BUILTIN_TYPES[type]
  }
  return type
}

export const getType = (
  expression: ast.Expression | undefined | null,
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
          getType(
            expression,
            document,
            documents,
            documentASTs,
            documentSymbols,
            documentImports
          ),
        ])
      ),
    }
  } else if (expression.type === "ObjectLiteral") {
    const objectLiteral = expression as ast.ObjectLiteral
    const properties: Record<string, TypeInfo | string | undefined> = {}
    for (const [key, value] of objectLiteral.value.entries()) {
      if (key.type === "StringLiteral") {
        properties[(key as ast.StringLiteral).value] = getType(
          value,
          document,
          documents,
          documentASTs,
          documentSymbols,
          documentImports
        )
      }
    }
    return { name: "dict", properties }
  } else if (expression.type === "MemberExpression") {
    const memberExpression = expression as ast.MemberExpression
    if (
      memberExpression.property.type === "StringLiteral" ||
      memberExpression.property.type === "Identifier" ||
      memberExpression.property.type === "IntegerLiteral"
    ) {
      const objectType = getType(
        memberExpression.object,
        document,
        documents,
        documentASTs,
        documentSymbols,
        documentImports
      )
      const memberType = (objectType?.properties ?? {})[
        (
          memberExpression.property as
            | ast.StringLiteral
            | ast.Identifier
            | ast.IntegerLiteral
        ).value.toString()
      ]
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

export const stringifySignatureInfo = (s: SignatureInfo) => {
  return `() -> ${resolveType(s.return)?.name ?? "None"}`
}
