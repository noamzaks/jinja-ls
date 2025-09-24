import { ast } from "@jinja-lsp/language"

export const walk = (
  program: ast.Program,
  callback: (statement: ast.Node) => boolean | void
) => {
  const statements: ast.Node[] = [program]
  while (statements.length !== 0) {
    const statement = statements.pop()!
    statements.push(...statement.children)
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
      }
    }
  })
  return token
}
