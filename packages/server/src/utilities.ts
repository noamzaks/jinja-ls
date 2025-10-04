import { ast } from "@jinja-ls/language"

export const walk = (
  program: ast.Program,
  callback: (statement: ast.Node) => boolean | void,
) => {
  const statements: ast.Node[] = [program]
  while (statements.length !== 0) {
    const statement = statements.shift()!
    statements.unshift(...statement.children)
    if (callback(statement)) {
      break
    }
  }
}

export const tokenAt = (tokens: ast.TokenNode[], offset: number) => {
  let low = 0
  let high = tokens.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (tokens[middle].start <= offset && offset <= tokens[middle].end) {
      return tokens[middle]
    } else if (tokens[middle].start <= offset) {
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return tokens[low]
}

export const parentOfType = (node: ast.Node | undefined, type: string) => {
  while (node !== undefined) {
    if (node.type === type) {
      return node
    }
    node = node.parent
  }
}
