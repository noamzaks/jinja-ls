import { ast, formatExpression } from "@jinja-ls/language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { URI, Utils } from "vscode-uri"
import { BUILTIN_TYPES } from "./builtinTypes"
import { SPECIAL_SYMBOLS } from "./constants"
import {
  configuration,
  documentASTs,
  documentGlobals,
  documentImports,
  documents,
  documentSymbols,
  getFilters,
  getTests,
  globals,
  rootURIs,
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

export const getParametersFromDocumentation = (documentation: string) => {
  const parameterTypes: Record<string, TypeReference> = {}

  const r = new RegExp(
    "@param\\s*(?:\\{([^\\}]+)\\})?\\s+(\\w+)(?::\\s*(.+))?",
    "g",
  )
  let match: RegExpMatchArray
  while ((match = r.exec(documentation)) !== null) {
    const type = match[1] ?? undefined
    const variable = match[2] ?? undefined
    const documentation = match[3] ?? undefined
    parameterTypes[variable] = { type, documentation }
  }

  return parameterTypes
}

export const collectSymbols = (
  statement: ast.Node,
  result: Map<string, SymbolInfo[]>,
  imports: (ast.Include | ast.Import | ast.FromImport | ast.Extends)[],
  lsCommands: string[],
) => {
  const addSymbol = (name: string, value: SymbolInfo) => {
    const values = result.get(name) ?? []
    values.push(value)
    result.set(name, values)
  }

  const addSymbolsFromAssignment = (
    assignee: ast.Node,
    value: ast.Expression,
    scope: ast.Node,
    documentation?: string,
  ) => {
    if (assignee instanceof ast.Identifier) {
      addSymbol(assignee.value, {
        type: "Variable",
        node: scope,
        identifierNode: assignee,
        getType: (document) => ({ ...getType(value, document), documentation }),
      })
    } else if (assignee instanceof ast.TupleLiteral) {
      for (let i = 0; i < assignee.value.length; i++) {
        const assigneeItem = assignee.value[i]
        if (assigneeItem instanceof ast.Identifier) {
          addSymbol(assigneeItem.value, {
            type: "Variable",
            node: scope,
            identifierNode: assigneeItem,
            getType: (document) => ({
              ...resolveType(
                resolveType(getType(value, document)).properties[i.toString()],
              ),
              documentation,
            }),
          })
        }
      }
    }
  }

  if (statement instanceof ast.Macro) {
    addSymbol(statement.name.value, {
      type: "Macro",
      node: statement,
    })
    const documentation = statement.getDocumentation()
    const parameterTypes = getParametersFromDocumentation(documentation)

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
            properties: {
              ...Object.fromEntries(
                statement.args.map((arg, index) => [
                  index.toString(),
                  {
                    type: "str",
                    literalValue: JSON.stringify(arg.identifierName),
                  },
                ]),
              ),
              ...BUILTIN_TYPES["tuple"].properties,
            },
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
          documentation,
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
          (argument instanceof ast.KeywordArgumentExpression
            ? getType(argument.value, document)
            : undefined) ?? parameterTypes[argument.identifierName],
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
    if (statement.value !== null) {
      addSymbolsFromAssignment(
        statement.assignee,
        statement.value,
        statement,
        statement.getDocumentation(),
      )
    } else if (statement.assignee instanceof ast.Identifier) {
      addSymbol(statement.assignee.value, {
        type: "Variable",
        node: statement,
        identifierNode: statement.assignee,
        getType: () => ({
          ...resolveType("str"),
          documentation: statement.getDocumentation(),
        }),
      })
    } else if (statement.assignee instanceof ast.FilterExpression) {
      let current = statement.assignee.operand
      while (current instanceof ast.FilterExpression) {
        current = current.operand
      }
      if (current instanceof ast.Identifier) {
        addSymbol(current.value, {
          type: "Variable",
          node: statement,
          identifierNode: current,
          getType: (document) => ({
            ...getType(statement.assignee, document),
            documentation: statement.getDocumentation(),
          }),
        })
      }
    }
  } else if (statement instanceof ast.With) {
    for (const assignment of statement.assignments) {
      addSymbolsFromAssignment(
        assignment.assignee,
        assignment.value,
        assignment.assignee,
      )
    }
  } else if (statement instanceof ast.CallStatement) {
    const documentation = statement.getDocumentation()
    const parameterTypes = getParametersFromDocumentation(documentation)
    for (let i = 0; i < statement.callerArgs.length; i++) {
      const arg = statement.callerArgs[i]
      if (arg instanceof ast.Identifier) {
        addSymbol(arg.value, {
          type: "Variable",
          node: statement.call,
          identifierNode: arg,
          getType: () => parameterTypes[arg.value],
        })
      }
    }
  } else if (
    statement instanceof ast.Import ||
    statement instanceof ast.Include ||
    statement instanceof ast.FromImport ||
    statement instanceof ast.Extends
  ) {
    imports.push(statement)
  } else if (
    statement instanceof ast.Comment &&
    statement.value.trim().startsWith("jinja-ls:")
  ) {
    lsCommands.push(statement.value.trim().slice("jinja-ls:".length).trim())
  }
}

export const argToPython = (arg: ast.Statement) => {
  if (arg instanceof ast.Identifier) {
    return arg.token.value
  } else if (arg instanceof ast.KeywordArgumentExpression) {
    return `${arg.key.token.value} = ${formatExpression(arg.value)}`
  }
}

export const getURIs = (currentUri: string) => [
  Utils.joinPath(URI.parse(currentUri), ".."),
  ...(configuration?.importURIs?.map((v) => URI.parse(v)) ?? []),
  ...rootURIs,
]

export const findImport = async (
  i: ast.Include | ast.Import | ast.FromImport | ast.Extends,
  uri: string,
  readFile: (uri: string) => Promise<string | undefined>,
) => {
  if (!(i.source instanceof ast.StringLiteral)) {
    return []
  }
  const importURIs = getURIs(uri)
  for (const baseURI of importURIs) {
    const uri = Utils.joinPath(baseURI, i.source.value).toString()
    const contents = await readFile(uri)
    if (contents !== undefined) {
      return [uri, contents]
    }
  }
  return []
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

export const findSymbolInDocument = <K extends SymbolInfo["type"]>(
  document: TextDocument,
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

    if (
      documentGlobals[document.uri] !== undefined &&
      documentGlobals[document.uri][name] !== undefined &&
      program !== undefined
    ) {
      return {
        type: "Variable",
        node: program,
        getType: () => getTypeInfoFromJS(documentGlobals[document.uri][name]),
      } as SymbolInfo as Extract<SymbolInfo, { type: K }>
    }

    if (
      inScopeOf instanceof ast.Identifier &&
      ((inScopeOf.parent instanceof ast.CallExpression &&
        inScopeOf.parent.parent instanceof ast.TestExpression &&
        inScopeOf.parent.parent.test === inScopeOf.parent &&
        inScopeOf.parent.callee === inScopeOf) ||
        (inScopeOf.parent instanceof ast.TestExpression &&
          inScopeOf === inScopeOf.parent.test))
    ) {
      return {
        type: "Variable",
        node: inScopeOf,
        getType: () => getTests()[inScopeOf.value],
      } as SymbolInfo as Extract<SymbolInfo, { type: K }>
    }

    if (
      inScopeOf instanceof ast.Identifier &&
      ((inScopeOf.parent instanceof ast.CallExpression &&
        (inScopeOf.parent.parent instanceof ast.FilterExpression ||
          inScopeOf.parent.parent instanceof ast.FilterStatement) &&
        inScopeOf.parent.parent.filter === inScopeOf.parent &&
        inScopeOf.parent.callee === inScopeOf) ||
        ((inScopeOf.parent instanceof ast.FilterExpression ||
          inScopeOf.parent instanceof ast.FilterStatement) &&
          inScopeOf.parent.filter === inScopeOf))
    ) {
      return {
        type: "Variable",
        node: inScopeOf,
        getType: () => getFilters()[inScopeOf.value],
      } as SymbolInfo as Extract<SymbolInfo, { type: K }>
    }
  }

  const symbolOptions = symbols?.get(name) ?? []

  // Look from the last to the first definition of this symbol to find the last one.
  for (let i = symbolOptions.length - 1; i >= 0; i--) {
    const symbol = symbolOptions[i]
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

  for (const i of imports ?? []) {
    const importStatement = i[0]
    if (
      importTypes !== undefined &&
      !importTypes.includes(importStatement.type)
    ) {
      continue
    }

    if (!isInScope(importStatement, inScopeOf, program)) {
      continue
    }

    const importedUri = i[1]
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
                importedDocument,
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
          importedDocument,
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
          importedDocument,
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
      document,
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
        if (
          value.type === type &&
          isInScope(value.node, node, program) &&
          value.node !== node
        ) {
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

    if (documentGlobals[document.uri]) {
      for (const key in documentGlobals[document.uri]) {
        result.set(key, [
          {
            type: "Variable",
            node: getProgramOf(node),
            getType: () =>
              getTypeInfoFromJS(documentGlobals[document.uri][key]),
          } as SymbolInfo as Extract<SymbolInfo, { type: K }>,
          document,
        ])
      }
    }
  }

  return result
}
