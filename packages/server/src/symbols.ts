import * as lsp from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { URI, Utils } from "vscode-uri"
import { ast, formatExpression, LexerError } from "../../language"
import { getType, TypeInfo, TypeReference } from "./types"
import { parentOfType } from "./utilities"

export type SymbolInfo =
  | {
      type: "Macro"
      node: ast.Macro
    }
  | {
      type: "Block"
      node: ast.Block
    }
  | {
      type: "Variable"
      node: ast.SetStatement | ast.Macro | ast.For | ast.Block | ast.Program
      identifierNode?: ast.Identifier
      getType: (
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
      ) => TypeInfo | TypeReference | undefined
    }

export const collectSymbols = (
  statement: ast.Node,
  result: Map<string, SymbolInfo[]>,
  imports: (ast.Include | ast.Import | ast.FromImport | ast.Extends)[]
) => {
  const addSymbol = (name: string, value: SymbolInfo) => {
    const values = result.get(name) ?? []
    values.push(value)
    result.set(name, values)
  }

  if (statement.type === "Macro") {
    const macroStatement = statement as ast.Macro
    addSymbol(macroStatement.name.value, {
      type: "Macro",
      node: macroStatement,
    })
    addSymbol(macroStatement.name.value, {
      type: "Variable",
      node: macroStatement,
      identifierNode: macroStatement.name,
      getType: () => ({
        name: "macro",
        properties: {
          name: { type: "str", documentation: "The name of the macro." },
          arguments: {
            name: "tuple",
            documentation:
              "A tuple of the names of arguments the macro accepts.",
            properties: Object.fromEntries(
              macroStatement.args.map((arg, index) => [
                index.toString(),
                {
                  type: "str",
                  literalValue: JSON.stringify(arg.identifierName),
                },
              ])
            ),
          },
          catch_kwargs: {
            type: "bool",
            documentation:
              "This is true if the macro accepts extra keyword arguments (i.e.: accesses the special kwargs variable).",
          },
          catch_varargs: {
            type: "bool",
            documentation:
              "This is true if the macro accepts extra positional arguments (i.e.: accesses the special varargs variable).",
          },
          caller: {
            type: "bool",
            documentation:
              "This is true if the macro accesses the special caller variable and may be called from a call tag.",
          },
        },
      }),
    })
    for (const argument of macroStatement.args) {
      addSymbol(argument.identifierName!, {
        type: "Variable",
        node: macroStatement,
        identifierNode:
          argument.type === "Identifier"
            ? (argument as ast.Identifier)
            : (argument as ast.KeywordArgumentExpression).key,
        getType: (
          document,
          documents,
          documentASTs,
          documentSymbols,
          documentImports
        ) =>
          argument.type === "KeywordArgumentExpression"
            ? getType(
                (argument as ast.KeywordArgumentExpression).value,
                document,
                documents,
                documentASTs,
                documentSymbols,
                documentImports
              )
            : undefined,
      })
    }
  } else if (statement.type === "Block") {
    const blockStatement = statement as ast.Block
    addSymbol(blockStatement.name.value, {
      type: "Block",
      node: blockStatement,
    })
  } else if (statement.type === "Set") {
    const setStatement = statement as ast.SetStatement
    if (setStatement.assignee.type === "Identifier") {
      const variableIdentifier = setStatement.assignee as ast.Identifier
      const variable = variableIdentifier.value
      addSymbol(variable, {
        type: "Variable",
        node: setStatement,
        identifierNode: variableIdentifier,
        getType: (
          document,
          documents,
          documentASTs,
          documentSymbols,
          documentImports
        ) =>
          getType(
            setStatement.value,
            document,
            documents,
            documentASTs,
            documentSymbols,
            documentImports
          ),
      })
    }
  } else if (
    statement.type === "Import" ||
    statement.type === "Include" ||
    statement.type === "FromImport" ||
    statement.type === "Extends"
  ) {
    const s = statement as
      | ast.Import
      | ast.Include
      | ast.FromImport
      | ast.Extends

    imports.push(s)
  }
}

export const argToPython = (arg: ast.Statement) => {
  if (arg.type === "Identifier") {
    const identifier = arg as ast.Identifier
    return identifier.token.value
  } else if (arg.type === "KeywordArgumentExpression") {
    const kwarg = arg as ast.KeywordArgumentExpression
    return `${kwarg.key.token.value} = ${formatExpression(kwarg.value)}`
  }
}

export const argToParameterInformation = (
  arg: ast.Statement
): lsp.ParameterInformation | undefined => {
  if (arg.type === "Identifier") {
    const identifier = arg as ast.Identifier
    return { label: identifier.token.value }
  } else if (arg.type === "KeywordArgumentExpression") {
    const kwarg = arg as ast.KeywordArgumentExpression
    return { label: kwarg.key.token.value }
  }
}

export const macroToSignature = (macro: ast.Macro) => {
  return `(${macro.args
    .map((arg) => argToPython(arg))
    .filter((x) => x !== undefined)
    .join(", ")}) -> str`
}

export const importToUri = (
  i: ast.Include | ast.Import | ast.FromImport | ast.Extends,
  uri: string
) => {
  if (i.source.type !== "StringLiteral") {
    return
  }
  return Utils.joinPath(
    URI.parse(uri),
    "..",
    (i.source as ast.StringLiteral).value
  ).toString()
}

export const getScope = (node: ast.Node | undefined) => {
  if (node?.type === "Block" && (node as ast.Block).scoped === undefined) {
    return
  }

  node = node?.parent
  while (node !== undefined && !node?.definesScope) {
    node = node.parent
  }
  return node
}

export const isInScope = (
  node: ast.Node,
  inScopeOf: ast.Node | undefined,
  program: ast.Program | undefined
) => {
  const scopeStart = inScopeOf?.getStart?.()
  const nodeStart = node.getStart()
  if (
    scopeStart !== undefined &&
    nodeStart !== undefined &&
    scopeStart < nodeStart
  ) {
    // Defined afterwards.
    return false
  }

  const symbolScope = getScope(node)
  let currentScope = getScope(inScopeOf) ?? program
  if (currentScope !== undefined) {
    while (currentScope !== undefined) {
      if (currentScope === symbolScope) {
        return true
      }
      currentScope = getScope(currentScope)
    }

    // Not in scope.
    return false
  }
  return false
}

const SPECIAL_SYMBOLS: Record<
  string,
  Record<string, string | TypeReference | TypeInfo | undefined>
> = {
  // These are the globals.
  Program: {
    true: "bool",
    false: "bool",
    none: "None",
    True: "bool",
    False: "bool",
    None: "None",
  },
  Macro: {
    varargs: {
      name: "tuple",
      documentation:
        "If more positional arguments are passed to the macro than accepted by the macro, they end up in the special varargs variable as a list of values.",
    },
    kwargs: {
      name: "dict",
      documentation:
        "Like varargs but for keyword arguments. All unconsumed keyword arguments are stored in this special variable.",
    },
    caller: {
      name: "function",
      signature: {
        return: "str",
        documentation:
          "If the macro was called from a call tag, the caller is stored in this variable as a callable macro.",
      },
    },
  },
  For: {
    loop: {
      name: "loop",
      properties: {
        index: {
          type: "int",
          documentation: "The current iteration of the loop. (1 indexed)",
        },
        index0: {
          type: "int",
          documentation: "The current iteration of the loop. (0 indexed)",
        },
        revindex: {
          type: "int",
          documentation:
            "The number of iterations from the end of the loop (1 indexed)",
        },
        revindex0: {
          type: "int",
          documentation:
            "The number of iterations from the end of the loop (0 indexed)",
        },
        first: { type: "bool", documentation: "True if first iteration." },
        last: { type: "bool", documentation: "True if last iteration." },
        length: {
          type: "int",
          documentation: "The number of items in the sequence.",
        },
        depth: {
          type: "int",
          documentation:
            "Indicates how deep in a recursive loop the rendering currently is. Starts at level 1",
        },
        depth0: {
          type: "int",
          documentation:
            "Indicates how deep in a recursive loop the rendering currently is. Starts at level 0",
        },
        previtem: {
          type: "unknown",
          documentation:
            "The item from the previous iteration of the loop. Undefined during the first iteration.",
        },
        nextitem: {
          type: "unknown",
          documentation:
            "The item from the following iteration of the loop. Undefined during the last iteration.",
        },
        cycle: {
          name: "function",
          signature: {
            documentation:
              "A helper function to cycle between a list of sequences.",
          },
        },
        changed: {
          name: "function",
          signature: {
            return: "bool",
            documentation:
              "True if previously called with a different value (or not called at all).",
          },
        },
      },
    },
  },
  Block: {
    super: {
      name: "super",
      signature: {
        return: "str",
        documentation: "The results of the parent block.",
      },
    },
  },
}

export const findSymbolInDocument = <K extends SymbolInfo["type"]>(
  symbols: Map<string, SymbolInfo[]> | undefined,
  name: string,
  type: K,
  program: ast.Program | undefined,
  inScopeOf: ast.Node | undefined = undefined
): Extract<SymbolInfo, { type: K }> | undefined => {
  if (type === "Variable") {
    for (const [definerType, specialSymbols] of Object.entries(
      SPECIAL_SYMBOLS
    )) {
      const parent = parentOfType(inScopeOf, definerType)
      if (specialSymbols[name] !== undefined && parent !== undefined) {
        return {
          type: "Variable",
          node: parent as ast.Macro | ast.For | ast.Block | ast.Program,
          identifierNode:
            parent.type === "Macro" ? (parent as ast.Macro).name : undefined,
          getType: () => specialSymbols[name],
        } as unknown as Extract<SymbolInfo, { type: K }>
      }
    }
  }

  // TODO: remove sorting here
  const symbolOptions = (symbols?.get(name) ?? []).sort(
    (a, b) => (a.node?.getStart() ?? 0) - (b.node?.getStart() ?? 0)
  )

  // Look from the last to the first definition of this symbol to find the last one.
  for (const symbol of symbolOptions.reverse()) {
    if (symbol?.type !== type) {
      continue
    }
    if (!symbol.node) {
      continue
    }
    if (!isInScope(symbol.node, inScopeOf, program)) {
      continue
    }
    return symbol as Extract<SymbolInfo, { type: K }>
  }
}

export const findSymbol = <K extends SymbolInfo["type"]>(
  document: TextDocument,
  inScopeOf: ast.Node | undefined,
  name: string,
  type: K,
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
  >,
  {
    checkCurrent,
    importTypes,
  }: { checkCurrent?: boolean; importTypes?: string[] } = {
    checkCurrent: true,
  }
): [Extract<SymbolInfo, { type: K }>, TextDocument] | [] => {
  const program = documentASTs.get(document.uri)?.program

  if (checkCurrent) {
    const symbol = findSymbolInDocument(
      documentSymbols.get(document.uri),
      name,
      type,
      program,
      inScopeOf
    )
    if (symbol !== undefined) {
      return [symbol, document]
    }
  }

  const imports = documentImports.get(document.uri)
  for (const importStatement of imports ?? []) {
    if (
      importTypes !== undefined &&
      !importTypes.includes(importStatement.type)
    ) {
      continue
    }

    if (!isInScope(importStatement, inScopeOf, program)) {
      continue
    }

    const importedUri = importToUri(importStatement, document.uri)
    if (!importedUri) {
      continue
    }
    const importedDocument = documents.get(importedUri)
    if (!importedDocument) {
      continue
    }

    const symbols = documentSymbols.get(importedUri)
    let symbol: Extract<SymbolInfo, { type: K }> | undefined = undefined
    if (importStatement.type === "Import") {
      const i = importStatement as ast.Import
      if (i.name.value === name) {
        // TODO: return a symbol containing all symbols from the imported document?
      }
    } else if (importStatement.type === "FromImport") {
      const importedSymbol = (importStatement as ast.FromImport).imports.find(
        (i) => (i.name ?? i.source).value === name
      )
      if (importedSymbol !== undefined) {
        symbol = findSymbolInDocument(
          symbols,
          importedSymbol.source.value,
          type,
          documentASTs.get(importedUri)?.program
        )
      }
    } else {
      symbol = findSymbolInDocument(
        symbols,
        name,
        type,
        documentASTs.get(importedUri)?.program
      )
    }

    if (symbol !== undefined) {
      return [symbol, importedDocument]
    }
  }

  return []
}
