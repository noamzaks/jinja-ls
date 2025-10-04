import { ast } from "@jinja-ls/language"

// TODO: why is this not sorted?
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

export const tokenAt = (program: ast.Program, offset: number) => {
  let token: ast.TokenNode | undefined
  walk(program, (statement) => {
    if (statement instanceof ast.TokenNode) {
      if (statement.start <= offset && offset <= statement.end) {
        token = statement
        return true
      } else if (
        statement.start <= offset &&
        (token === undefined || statement.end > token.end)
      ) {
        token = statement
      }
    }
  })
  return token
}

export const parentOfType = (node: ast.Node | undefined, type: string) => {
  while (node !== undefined) {
    if (node.type === type) {
      return node
    }
    node = node.parent
  }
}
