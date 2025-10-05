import { ast, LexerError } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { SymbolInfo } from "./symbols"

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
  [ast.Include | ast.Import | ast.FromImport | ast.Extends, string][]
>()
export const documentSymbols = new Map<string, Map<string, SymbolInfo[]>>()
export const globals: Record<string, unknown> = {}
export const configuration: {
  importPaths?: string[] | undefined
  initialized: boolean
} = { initialized: false }
