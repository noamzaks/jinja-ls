import { ast, LexerError } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { URI } from "vscode-uri"
import { BUILTIN_FILTERS, BUILTIN_TESTS } from "./constants"
import { SymbolInfo } from "./symbols"
import { TypeInfo } from "./types"

export const rootURIs: URI[] = []
export const documents = new Map<string, TextDocument>()
export const documentASTs = new Map<
  string,
  {
    program?: ast.Program
    tokens?: ast.TokenNode[]
    lexerErrors?: LexerError[]
    parserErrors?: ast.ErrorNode[]
  }
>()
export const documentImports = new Map<
  string,
  [
    ast.Include | ast.Import | ast.FromImport | ast.Extends,
    string | undefined,
  ][]
>()
export const documentSymbols = new Map<string, Map<string, SymbolInfo[]>>()
export const globals: Record<string, unknown> = {}
export const documentGlobals: Record<string, Record<string, unknown>> = {}
export const configuration: {
  importURIs?: string[] | undefined
  extraTests?: Record<string, TypeInfo>
  extraFilters?: Record<string, TypeInfo>
  initialized: boolean
} = { initialized: false }

export const getTests = () => ({
  ...BUILTIN_TESTS,
  ...configuration.extraTests,
})
export const getFilters = () => ({
  ...BUILTIN_FILTERS,
  ...configuration.extraFilters,
})
