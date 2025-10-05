import { ast, formatExpression } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { URI, Utils } from "vscode-uri"
import {
  documentASTs,
  documentImports,
  documents,
  documentSymbols,
  globals,
} from "./state"
import {
  ArgumentInfo,
  getType,
  getTypeInfoFromJS,
  resolveType,
  TypeInfo,
  TypeReference,
} from "./types"
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
      node: ast.Node
      identifierNode?: ast.Identifier
      getType: (document: TextDocument) => TypeInfo | TypeReference | undefined
    }

export const argToArgumentInfo = (arg: ast.Expression): ArgumentInfo => {
  if (arg instanceof ast.Identifier) {
    return { name: arg.identifierName }
  }
  const kwarg = arg as ast.KeywordArgumentExpression
  return { name: kwarg.identifierName, default: formatExpression(kwarg.value) }
}

export const collectSymbols = (
  statement: ast.Node,
  result: Map<string, SymbolInfo[]>,
  imports: (ast.Include | ast.Import | ast.FromImport | ast.Extends)[],
) => {
  const addSymbol = (name: string, value: SymbolInfo) => {
    const values = result.get(name) ?? []
    values.push(value)
    result.set(name, values)
  }

  if (statement instanceof ast.Macro) {
    addSymbol(statement.name.value, {
      type: "Macro",
      node: statement,
    })
    addSymbol(statement.name.value, {
      type: "Variable",
      node: statement,
      identifierNode: statement.name,
      getType: () => ({
        name: "macro",
        properties: {
          name: { type: "str", documentation: "The name of the macro." },
          arguments: {
            name: "tuple",
            documentation:
              "A tuple of the names of arguments the macro accepts.",
            properties: Object.fromEntries(
              statement.args.map((arg, index) => [
                index.toString(),
                {
                  type: "str",
                  literalValue: JSON.stringify(arg.identifierName),
                },
              ]),
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
        signature: {
          arguments: statement.args.map(argToArgumentInfo),
          return: "str",
        },
      }),
    })
    for (const argument of statement.args) {
      addSymbol(argument.identifierName, {
        type: "Variable",
        // Scoped to be inside the macro
        node: statement.name,
        identifierNode:
          argument instanceof ast.Identifier
            ? argument
            : (argument as ast.KeywordArgumentExpression).key,
        getType: (document) =>
          argument instanceof ast.KeywordArgumentExpression
            ? getType(argument.value, document)
            : undefined,
      })
    }
  } else if (statement instanceof ast.Block) {
    addSymbol(statement.name.value, {
      type: "Block",
      node: statement,
    })
  } else if (statement instanceof ast.For) {
    if (statement.loopvar instanceof ast.Identifier) {
      const loopvarIdentifier = statement.loopvar
      addSymbol(loopvarIdentifier.value, {
        type: "Variable",
        node: statement.loopvar,
        identifierNode: loopvarIdentifier,
        getType: (document) =>
          resolveType(
            resolveType(getType(statement.iterable, document))?.elementType,
          ),
      })
    } else {
      const loopvarTuple = statement.loopvar
      loopvarTuple.value.forEach((loopvarTupleItem, index) => {
        if (loopvarTupleItem instanceof ast.Identifier) {
          addSymbol(loopvarTupleItem.value, {
            type: "Variable",
            node: statement.loopvar,
            identifierNode: loopvarTupleItem,
            getType: (document) =>
              resolveType(
                (resolveType(
                  resolveType(getType(statement.iterable, document))
                    ?.elementType,
                )?.properties ?? [])[index],
              ),
          })
        }
      })
    }
  } else if (statement instanceof ast.SetStatement) {
    if (statement.assignee instanceof ast.Identifier) {
      const variableIdentifier = statement.assignee
      const variable = variableIdentifier.value
      addSymbol(variable, {
        type: "Variable",
        node: statement,
        identifierNode: variableIdentifier,
        getType: (document) => getType(statement.value, document),
      })
    }
  } else if (
    statement instanceof ast.Import ||
    statement instanceof ast.Include ||
    statement instanceof ast.FromImport ||
    statement instanceof ast.Extends
  ) {
    imports.push(statement)
  }
}

export const argToPython = (arg: ast.Statement) => {
  if (arg instanceof ast.Identifier) {
    return arg.token.value
  } else if (arg instanceof ast.KeywordArgumentExpression) {
    return `${arg.key.token.value} = ${formatExpression(arg.value)}`
  }
}

export const importToUri = (
  i: ast.Include | ast.Import | ast.FromImport | ast.Extends,
  uri: string,
) => {
  if (!(i.source instanceof ast.StringLiteral)) {
    return
  }
  return Utils.joinPath(URI.parse(uri), "..", i.source.value).toString()
}

export const getScope = (node: ast.Node | undefined, initial = false) => {
  if (!initial && node instanceof ast.Block && node.scoped === undefined) {
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
  program: ast.Program | undefined,
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

  const symbolScope = getScope(node, true)
  let currentScope = getScope(inScopeOf, true) ?? program
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
    range: {
      name: "class",
      signature: {
        arguments: [
          {
            name: "start",
            type: "int",
          },
          {
            name: "stop",
            type: "int",
          },
          {
            name: "step",
            type: "int",
          },
        ],
        return: {
          name: "range",
          elementType: "int",
        },
      },
    },
    dict: {
      name: "class",
      signature: {
        documentation:
          "A convenient alternative to dict literals. {'foo': 'bar'} is the same as dict(foo='bar').",
        return: "dict",
      },
    },
    lipsum: {
      name: "function",
      signature: {
        documentation: "Generate some lorem ipsum for the template.",
        arguments: [
          {
            name: "html",
            type: "bool",
            default: "True",
          },
          {
            name: "min",
            type: "int",
            default: "20",
          },
          {
            name: "max",
            type: "int",
            default: "100",
          },
        ],
        return: "str",
      },
    },
    cycler: {
      name: "class",
      signature: {
        documentation:
          "Cycle through values by yield them one at a time, then restarting once the end is reached.",
      },
    },
    joiner: {
      name: "class",
      signature: {
        arguments: [
          {
            name: "sep",
            type: "str",
            default: '", "',
          },
        ],
        documentation:
          'A tiny helper that can be used to "join" multiple sections. A joiner is passed a string and will return that string every time it\'s called, except the first time (in which case it returns an empty string).',
        return: "joiner",
      },
    },
    namespace: {
      name: "class",
      signature: {
        documentation:
          "A namespace object that can hold arbitrary attributes.  It may be initialized from a dictionary or with keyword arguments.",
        return: "namespace",
      },
    },
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
  inScopeOf: ast.Node | undefined = undefined,
): Extract<SymbolInfo, { type: K }> | undefined => {
  if (type === "Variable") {
    for (const [definerType, specialSymbols] of Object.entries(
      SPECIAL_SYMBOLS,
    )) {
      const parent = parentOfType(inScopeOf, definerType)
      if (specialSymbols[name] !== undefined && parent !== undefined) {
        return {
          type: "Variable",
          node: parent,
          identifierNode: parent instanceof ast.Macro ? parent.name : undefined,
          getType: () => specialSymbols[name],
        } as SymbolInfo as Extract<SymbolInfo, { type: K }>
      }
    }

    if (globals[name] !== undefined && program !== undefined) {
      return {
        type: "Variable",
        node: program,
        getType: () => getTypeInfoFromJS(globals[name]),
      } as SymbolInfo as Extract<SymbolInfo, { type: K }>
    }
  }

  const symbolOptions = symbols?.get(name) ?? []

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

export const getImportedSymbols = <K extends SymbolInfo["type"]>(
  inScopeOf: ast.Node | undefined,
  type: K,
  document: TextDocument,
  importTypes?: string[],
) => {
  const imports = documentImports.get(document.uri)
  const program = documentASTs.get(document.uri)?.program

  const symbols = new Map<
    string,
    [Extract<SymbolInfo, { type: K }>, TextDocument]
  >()
  if (program === undefined) {
    return symbols
  }

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

    const importedSymbols = documentSymbols.get(importedUri)
    const importedAST = documentASTs.get(importedUri)?.program
    if (!importedAST) {
      continue
    }

    if (importStatement instanceof ast.Import && type === "Variable") {
      symbols.set(importStatement.name.value, [
        {
          type: "Variable",
          node: importedAST,
          getType: () => {
            const typeInfo: TypeInfo = { name: "namespace", properties: {} }
            for (const symbolName of importedSymbols?.keys() ?? []) {
              const symbolValue = findSymbolInDocument(
                importedSymbols,
                symbolName,
                "Variable",
                importedAST,
              )
              if (symbolValue !== undefined) {
                typeInfo.properties![symbolName] =
                  symbolValue.getType(importedDocument)
              }
            }
            return typeInfo
          },
        } as unknown as Extract<SymbolInfo, { type: K }>,
        importedDocument,
      ])
    } else if (importStatement instanceof ast.FromImport) {
      for (const fromImport of importStatement.imports) {
        const symbolName = (fromImport.name ?? fromImport.source).value
        const symbolValue = findSymbolInDocument(
          importedSymbols,
          fromImport.source.value,
          type,
          importedAST,
        )
        if (symbolValue !== undefined) {
          symbols.set(symbolName, [symbolValue, importedDocument])
        }
      }
    } else {
      for (const symbolName of importedSymbols?.keys() ?? []) {
        const symbolValue = findSymbolInDocument(
          importedSymbols,
          symbolName,
          type,
          importedAST,
        )
        if (symbolValue !== undefined) {
          symbols.set(symbolName, [symbolValue, importedDocument])
        }
      }
    }
  }

  return symbols
}

export const findSymbol = <K extends SymbolInfo["type"]>(
  document: TextDocument,
  inScopeOf: ast.Node | undefined,
  name: string,
  type: K,
  {
    checkCurrent,
    importTypes,
  }: { checkCurrent?: boolean; importTypes?: string[] } = {
    checkCurrent: true,
  },
): [Extract<SymbolInfo, { type: K }>, TextDocument] | [] => {
  const program = documentASTs.get(document.uri)?.program

  if (checkCurrent) {
    const symbol = findSymbolInDocument(
      documentSymbols.get(document.uri),
      name,
      type,
      program,
      inScopeOf,
    )
    if (symbol !== undefined) {
      return [symbol, document]
    }
  }

  const importedSymbols = getImportedSymbols(
    inScopeOf,
    type,
    document,
    importTypes,
  )
  return importedSymbols.get(name) ?? []
}

export const getProgramOf = (node: ast.Node) => {
  while (node.parent !== undefined) {
    node = node.parent
  }
  return node
}

export const findSymbolsInScope = <K extends SymbolInfo["type"]>(
  node: ast.Node,
  type: K,
  document: TextDocument,
): Map<string, [Extract<SymbolInfo, { type: K }>, TextDocument]> => {
  const result = new Map<
    string,
    [Extract<SymbolInfo, { type: K }>, TextDocument]
  >()

  const program = documentASTs.get(document.uri)?.program
  const symbols = documentSymbols.get(document.uri)
  if (program !== undefined && symbols !== undefined) {
    for (const [symbolName, symbolValues] of symbols.entries() ?? []) {
      for (const value of symbolValues) {
        if (value.type === type && isInScope(value.node, node, program)) {
          result.set(symbolName, [
            value as unknown as Extract<SymbolInfo, { type: K }>,
            document,
          ])
          break
        }
      }
    }
  }

  const importedSymbols = getImportedSymbols(node, type, document)

  for (const [key, value] of importedSymbols.entries()) {
    result.set(key, value)
  }

  if (type === "Variable") {
    for (const [definerType, specialSymbols] of Object.entries(
      SPECIAL_SYMBOLS,
    )) {
      const parent = parentOfType(node, definerType)
      if (parent !== undefined) {
        for (const symbolName in specialSymbols) {
          result.set(symbolName, [
            {
              type: "Variable",
              node: parent as ast.Macro | ast.For | ast.Block | ast.Program,
              identifierNode:
                parent instanceof ast.Macro ? parent.name : undefined,
              getType: () => specialSymbols[symbolName],
            } as SymbolInfo as Extract<SymbolInfo, { type: K }>,
            document,
          ])
        }
      }
    }

    for (const key in globals) {
      result.set(key, [
        {
          type: "Variable",
          node: getProgramOf(node),
          getType: () => getTypeInfoFromJS(globals[key]),
        } as SymbolInfo as Extract<SymbolInfo, { type: K }>,
        document,
      ])
    }
  }

  return result
}
