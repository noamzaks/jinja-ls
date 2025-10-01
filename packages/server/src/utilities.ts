import { ast } from "../../language"

// TODO: why is this not sorted?
export const walk = (
  program: ast.Program,
  callback: (statement: ast.Node) => boolean | void
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
    if (statement.type === "TokenNode") {
      const statementToken = statement as ast.TokenNode
      if (statementToken.start <= offset && offset <= statementToken.end) {
        token = statementToken
        return true
      } else if (
        statementToken.start <= offset &&
        (token === undefined || statementToken.end > token.end)
      ) {
        token = statementToken
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
