import {
  ArrayLiteral,
  BinaryExpression,
  Block,
  CallExpression,
  CallStatement,
  Comment,
  ErrorNode,
  Extends,
  FilterExpression,
  FilterStatement,
  FloatLiteral,
  For,
  FromImport,
  Identifier,
  If,
  Import,
  Include,
  IntegerLiteral,
  KeywordArgumentExpression,
  Macro,
  MemberExpression,
  MissingNode,
  Node,
  ObjectLiteral,
  Program,
  Raw,
  SelectExpression,
  SetStatement,
  SliceExpression,
  SpreadExpression,
  Statement,
  StringLiteral,
  Ternary,
  TestExpression,
  TokenNode,
  TupleLiteral,
  UnaryExpression,
  UnexpectedToken,
} from "./ast"
import type { TokenType } from "./lexer"
import { Token, TOKEN_TYPES } from "./lexer"

/**
 * Generate the Abstract Syntax Tree (AST) from a list of tokens.
 * Operator precedence can be found here: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence#table
 */
export function parse(tokens: Token[]): Program
export function parse(tokens: Token[], safe: false): Program
export function parse(
  tokens: Token[],
  safe: true,
): [Program, TokenNode[], ErrorNode[]]
export function parse(
  tokens: Token[],
  safe = false,
): Program | [Program, TokenNode[], ErrorNode[]] {
  const program = new Program([])
  let current = 0
  const errors: ErrorNode[] = []
  const tokenNodes: TokenNode[] = []

  function createErrorToken() {
    return new Token("error", "Error", 0, 0)
  }

  function createTokenNode(token: Token | undefined) {
    if (token === undefined) {
      return undefined
    }
    const tokenNode = new TokenNode(token)
    tokenNodes.push(tokenNode)
    return tokenNode
  }

  /**
   * Consume the next token if it matches the expected type, otherwise throw an error.
   * @param type The expected token type
   * @param error The error message to throw if the token does not match the expected type
   * @returns The consumed token
   */
  function expect(type: string, missingType: string): Token {
    if (current >= tokens.length) {
      createMissingNode(missingType)
      return createErrorToken()
    }

    const prev = tokens[current++]
    if (!prev || prev.type !== type) {
      current--
      createMissingNode(missingType, prev)
      return createErrorToken()
    }
    return prev
  }

  function expectIdentifier(name: string): Token {
    if (current >= tokens.length) {
      createMissingNode(`'${name}'`)
      return createErrorToken()
    }

    if (!isIdentifier(name)) {
      createMissingNode(name, tokens[current])
      current++
      return createErrorToken()
    }
    return tokens[current++]
  }

  function expectCloserStatement(result: Node, name: string) {
    if (current >= tokens.length) {
      createMissingNode(`'{% ${name} %}'`)
      return
    }

    result.addChild(
      createTokenNode(expect(TOKEN_TYPES.OpenStatement, "'{%'")),
      "closerOpenToken",
    )
    result.addChild(createTokenNode(expectIdentifier(name)), "closerIdentifier")
    result.addChild(
      createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
      "closerCloseToken",
    )
  }

  function parseAny(): Statement {
    switch (tokens[current].type) {
      case TOKEN_TYPES.Comment:
        return new Comment(tokens[current], tokens[current++].value)
      case TOKEN_TYPES.Text:
        return parseText()
      case TOKEN_TYPES.OpenStatement:
        return parseJinjaStatement()
      case TOKEN_TYPES.OpenExpression:
        return parseJinjaExpression()
      default:
        return createMissingNode("statement", tokens[current++])
    }
  }

  function is(...types: TokenType[]): boolean {
    return (
      current + types.length <= tokens.length &&
      types.every((type, i) => type === tokens[current + i].type)
    )
  }

  function isStatement(...names: string[]): boolean {
    return (
      tokens[current]?.type === TOKEN_TYPES.OpenStatement &&
      tokens[current + 1]?.type === TOKEN_TYPES.Identifier &&
      names.includes(tokens[current + 1]?.value)
    )
  }

  function isIdentifier(...names: string[]): boolean {
    return (
      current + names.length <= tokens.length &&
      names.every(
        (name, i) =>
          tokens[current + i].type === "Identifier" &&
          name === tokens[current + i].value,
      )
    )
  }

  function createMissingNode(
    missingType: string,
    before?: Token | undefined,
    nodeToDeduplicate?: Node,
  ) {
    // Remove the previously created missing node.
    if (nodeToDeduplicate?.type === "MissingNode") {
      errors.pop()
    }

    const node = new MissingNode(
      missingType,
      before ?? tokens[tokens.length - 1],
    )
    errors.push(node)
    return node
  }

  function createUnexpectedToken(message: string, before: Token) {
    const unexpected = new UnexpectedToken(message, before)
    errors.push(unexpected)
    return unexpected
  }

  function parseText(): StringLiteral {
    const token = expect(TOKEN_TYPES.Text, "text")
    return new StringLiteral(token.value, [createTokenNode(token)])
  }

  function eatUntil(type: string, missingType: string, includingEnd = true) {
    while (current < tokens.length && tokens[current]?.type !== type) {
      current++
    }
    if (current === tokens.length) {
      createMissingNode(missingType)
    }
    if (tokens[current]?.type === type && includingEnd) {
      current++
    }
  }

  function parseJinjaStatement(): Statement {
    // Consume {% token
    const openToken = expect(TOKEN_TYPES.OpenStatement, "'{%'")
    let closeToken: Token | undefined = undefined

    // next token must be Identifier whose .value tells us which statement
    if (tokens[current]?.type !== TOKEN_TYPES.Identifier) {
      const result = createMissingNode("statement name", tokens[current])
      eatUntil(TOKEN_TYPES.CloseStatement, "'%}'")
      return result
    }
    const identifier = tokens[current]
    const name = tokens[current]?.value
    let result: Statement
    switch (name) {
      case "raw":
        ++current
        result = parseRawStatement()
        break
      case "block":
        ++current
        result = parseBlockStatement()
        break
      case "include":
        ++current
        result = parseIncludeStatement()
        break
      case "from":
        ++current
        result = parseFromImportStatement()
        break
      case "import":
        ++current
        result = parseImportStatement()
        break
      case "extends":
        ++current
        result = parseExtendsStatement()
        break
      case "set":
        ++current
        result = parseSetStatement()
        break
      case "if":
        ++current
        result = parseIfStatement()
        expectCloserStatement(result, "endif")
        break
      case "macro":
        ++current
        result = parseMacroStatement()
        if (result.type === "Macro") {
          expectCloserStatement(result, "endmacro")
        }
        break
      case "for":
        ++current
        result = parseForStatement()
        if (result.type === "For") {
          // expect {% endfor %}
          expectCloserStatement(result, "endfor")
        }
        break
      case "call": {
        ++current // consume 'call'
        let callerArgs: [Token, Statement[], Token] | null = null
        if (is(TOKEN_TYPES.OpenParen)) {
          // Optional caller arguments, e.g. {% call(user) dump_users(...) %}
          callerArgs = parseArgs()
        }

        const calleeStart = current
        const callee = parsePrimaryExpression()
        if (callee.type !== "Identifier") {
          const missingNode = createMissingNode(
            "identifier for callee",
            tokens[calleeStart],
            callee,
          )
          eatUntil(TOKEN_TYPES.CloseStatement, "'%}'")
          return missingNode
        }
        const [callOpenParen, callArgs, callCloseParen] = parseArgs()
        closeToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")
        const body: Statement[] = []
        while (current < tokens.length && !isStatement("endcall")) {
          body.push(parseAny())
        }
        const callExpr = new CallExpression(
          callee,
          callArgs,
          createTokenNode(callOpenParen),
          createTokenNode(callCloseParen),
        )
        result = new CallStatement(
          callExpr,
          callerArgs?.[1] ?? null,
          body,
          createTokenNode(callerArgs?.[0]),
          createTokenNode(callerArgs?.[2]),
        )
        expectCloserStatement(result, "endcall")
        break
      }
      case "filter": {
        ++current // consume 'filter'
        let filterNode = parsePrimaryExpression()
        if (filterNode instanceof Identifier && is(TOKEN_TYPES.OpenParen)) {
          filterNode = parseCallExpression(filterNode)
        }
        closeToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")
        const filterBody: Statement[] = []
        while (current < tokens.length && !isStatement("endfilter")) {
          filterBody.push(parseAny())
        }
        result = new FilterStatement(
          filterNode as Identifier | CallExpression,
          filterBody,
        )

        expectCloserStatement(result, "endfilter")
        break
      }
      default:
        result = createUnexpectedToken(
          `Unexpected statement '${name}'`,
          tokens[current],
        )
        if (!name) {
          current--
          eatUntil(TOKEN_TYPES.CloseStatement, "'%}'", false)
          result.addChild(createTokenNode(tokens[current++]), "closeToken")
        }
        break
    }
    result.addChild(createTokenNode(openToken), "openToken")
    result.addChild(createTokenNode(identifier), "identifier")
    if (closeToken) {
      result.addChild(createTokenNode(closeToken), "closeToken")
    }

    return result
  }

  function parseJinjaExpression(): Statement {
    // Consume {{ }} tokens
    const openToken = expect(TOKEN_TYPES.OpenExpression, "'{{'")

    const result = parseExpression()
    result.addChild(createTokenNode(openToken), "openToken")

    result.addChild(
      createTokenNode(expect(TOKEN_TYPES.CloseExpression, "'}}'")),
      "closeToken",
    )

    return result
  }

  function parseImportContext(): Identifier | undefined {
    if (isIdentifier("with", "context") || isIdentifier("without", "context")) {
      const result = new Identifier(
        tokens[current].value,
        createTokenNode(
          new Token(
            tokens[current].value,
            TOKEN_TYPES.Identifier,
            tokens[current].start,
            tokens[current + 1].end,
          ),
        ),
      )
      current += 2
      return result
    }
  }

  function parseIncludeStatement(): Include | MissingNode {
    const name = parseExpression()
    let ignoreMissing: Identifier | undefined
    if (isIdentifier("ignore", "missing")) {
      ignoreMissing = new Identifier(
        "ignore missing",
        createTokenNode(
          new Token(
            "ignore missing",
            TOKEN_TYPES.Identifier,
            tokens[current].start,
            tokens[current + 1].end,
          ),
        ),
      )
      current += 2
    }
    const result = new Include(name, ignoreMissing, parseImportContext())
    result.addChild(
      createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
      "closeToken",
    )
    return result
  }

  function parseImportStatement(): Import | MissingNode {
    const source = parseExpression()
    const asToken = expectIdentifier("as")
    const name = expect(TOKEN_TYPES.Identifier, "identifier")
    const result = new Import(
      source,
      createTokenNode(asToken),
      new Identifier(name.value, createTokenNode(name)),
      parseImportContext(),
    )
    result.addChild(
      createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
      "closeToken",
    )
    return result
  }

  function parseFromImportStatement(): FromImport | MissingNode {
    const source = parseExpression()
    const importToken = expectIdentifier("import")
    const imports: {
      source: Identifier
      asToken: TokenNode | undefined
      name: Identifier | undefined
    }[] = []
    let context: Identifier | undefined = undefined

    while (
      tokens[current]?.type === "Identifier" ||
      tokens[current]?.type === "Comma"
    ) {
      context = parseImportContext()
      if (context !== undefined) {
        break
      }

      if (imports.length !== 0) {
        expect(TOKEN_TYPES.Comma, "','")
      }

      if (tokens[current]?.type !== "Identifier") {
        const missing = createMissingNode(
          "identifier to import",
          tokens[current],
        )
        eatUntil(TOKEN_TYPES.CloseStatement, "'%}'")
        return missing
      }

      const source = new Identifier(
        tokens[current].value,
        createTokenNode(tokens[current]),
      )
      current++
      let asToken: TokenNode | undefined = undefined
      let name: Identifier | undefined = undefined
      if (tokens[current]?.type === "Identifier") {
        context = parseImportContext()
        if (context === undefined) {
          asToken = createTokenNode(expectIdentifier("as"))
          const nameIdentifier = expect(
            TOKEN_TYPES.Identifier,
            "identifier for imported name",
          )
          if (nameIdentifier.type === "Error") {
            eatUntil(TOKEN_TYPES.CloseStatement, "'%}'")
            return errors[errors.length - 1] as MissingNode
          }

          name = new Identifier(
            nameIdentifier.value,
            createTokenNode(nameIdentifier),
          )
        }
      }
      imports.push({ source, asToken, name })
    }

    if (imports.length === 0) {
      const missing = createMissingNode("identifier to import", tokens[current])
      eatUntil(TOKEN_TYPES.CloseStatement, "'%}'")
      return missing
    }

    const result = new FromImport(
      source,
      createTokenNode(importToken),
      imports,
      context,
    )
    result.addChild(
      createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
      "closeToken",
    )
    return result
  }

  function parseExtendsStatement(): Extends | MissingNode {
    const name = parseExpression()
    const result = new Extends(name)
    result.addChild(
      createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
      "closeToken",
    )
    return result
  }

  function parseRawStatement(): Raw {
    const body: Statement[] = []
    const closeToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")
    while (current < tokens.length && !isStatement("endraw")) {
      current++
    }
    const raw = new Raw(body)
    raw.addChild(createTokenNode(closeToken), "closeToken")
    expectCloserStatement(raw, "endraw")
    return raw
  }

  function parseBlockStatement(): Block {
    const body: Statement[] = []
    const name = expect(TOKEN_TYPES.Identifier, "identifier")
    let required: TokenNode | undefined = undefined
    let scoped: TokenNode | undefined = undefined
    if (
      tokens[current].type === "Identifier" &&
      tokens[current].value === "scoped"
    ) {
      scoped = createTokenNode(tokens[current++])
    }
    if (
      tokens[current].type === "Identifier" &&
      tokens[current].value === "required"
    ) {
      required = createTokenNode(tokens[current++])
    }

    const closeToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")
    while (current < tokens.length && !isStatement("endblock")) {
      body.push(parseAny())
    }
    const block = new Block(
      new Identifier(name.value, createTokenNode(name)),
      body,
      required,
      scoped,
    )
    block.addChild(createTokenNode(closeToken), "closeToken")
    if (current >= tokens.length) {
      createMissingNode(`'{% endblock %}'`)
      return block
    }

    block.addChild(
      createTokenNode(expect(TOKEN_TYPES.OpenStatement, "'{%'")),
      "closerOpenToken",
    )
    block.addChild(
      createTokenNode(expectIdentifier("endblock")),
      "closerIdentifier",
    )
    if (tokens[current].type === "Identifier") {
      if (tokens[current].value !== name.value) {
        createUnexpectedToken(
          `Expected '${name.value}', got '${tokens[current].value}' instead`,
          tokens[current],
        )
      }
      current++
    }
    block.addChild(
      createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
      "closerCloseToken",
    )
    return block
  }

  // NOTE: `set` acts as both declaration statement and assignment expression
  function parseSetStatement(): Statement {
    const left = parseExpressionSequence()
    let value: Statement | null = null
    const body: Statement[] = []
    let equalsToken: Token | undefined = undefined
    let closeToken: Token | undefined = undefined
    let closerOpenToken: Token | undefined = undefined
    let closerIdentifier: Token | undefined = undefined
    if (is(TOKEN_TYPES.Equals)) {
      equalsToken = tokens[current]
      ++current
      value = parseExpressionSequence()
    } else {
      // parsing multiline set here
      closeToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")
      while (current < tokens.length && !isStatement("endset")) {
        body.push(parseAny())
      }
      closerOpenToken = expect(TOKEN_TYPES.OpenStatement, "'{%'")
      closerIdentifier = expectIdentifier("endset")
    }
    const result = new SetStatement(
      left,
      value,
      body,
      createTokenNode(equalsToken),
    )
    if (closeToken) {
      result.addChild(createTokenNode(closeToken), "closeToken")
      result.addChild(createTokenNode(closerOpenToken!), "closerOpenToken")
      result.addChild(createTokenNode(closerIdentifier!), "closerIdentifier")
      result.addChild(
        createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
        "closerCloseToken",
      )
    } else {
      result.addChild(
        createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
        "closeToken",
      )
    }
    return result
  }

  function parseIfStatement(): If {
    const test = parseExpression()

    test.addChild(
      createTokenNode(expect(TOKEN_TYPES.CloseStatement, "'%}'")),
      "closeToken",
    )

    const body: Statement[] = []
    const alternate: Statement[] = []

    // Keep parsing 'if' body until we reach the first {% elif %} or {% else %} or {% endif %}
    while (current < tokens.length && !isStatement("elif", "else", "endif")) {
      body.push(parseAny())
    }

    let elseOpenToken: Token | undefined = undefined
    let elseIdentifier: Token | undefined = undefined
    let elseCloseToken: Token | undefined = undefined
    // handle {% elif %}
    if (isStatement("elif")) {
      const elifOpenToken = tokens[current]
      ++current // consume {%
      const elifIdentifier = tokens[current]
      ++current // consume 'elif'
      const result = parseIfStatement() // nested If
      result.addChild(createTokenNode(elifOpenToken), "openToken")
      result.addChild(createTokenNode(elifIdentifier), "identifier")
      alternate.push(result)
    }
    // handle {% else %}
    else if (isStatement("else")) {
      elseOpenToken = tokens[current]
      ++current // consume {%
      elseIdentifier = tokens[current]
      ++current // consume 'else'
      elseCloseToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")

      // keep going until we hit {% endif %}
      while (current < tokens.length && !isStatement("endif")) {
        alternate.push(parseAny())
      }
    }

    return new If(
      test,
      body,
      alternate,
      createTokenNode(elseOpenToken),
      createTokenNode(elseIdentifier),
      createTokenNode(elseCloseToken),
    )
  }

  function parseMacroStatement(): Macro | MissingNode {
    const nameStart = current
    const name = parsePrimaryExpression()
    if (name.type !== "Identifier") {
      const result = createMissingNode("macro name", tokens[nameStart], name)
      eatUntil(TOKEN_TYPES.CloseStatement, "'%}'")
      return result
    }
    const [argsOpenParen, args, argsCloseParen] = parseArgs()
    const closeToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")

    // Body of macro
    const body: Statement[] = []

    // Keep going until we hit {% endmacro
    while (current < tokens.length && !isStatement("endmacro")) {
      body.push(parseAny())
    }

    const result = new Macro(
      name as Identifier,
      args,
      body,
      createTokenNode(argsOpenParen),
      createTokenNode(argsCloseParen),
    )
    result.addChild(createTokenNode(closeToken), "closeToken")
    return result
  }

  function parseExpressionSequence(primary = false): Statement {
    const fn = primary ? parsePrimaryExpression : parseExpression
    const expressions = [fn()]
    const isTuple = is(TOKEN_TYPES.Comma)
    while (isTuple) {
      ++current // consume comma
      expressions.push(fn())
      if (!is(TOKEN_TYPES.Comma)) {
        break
      }
    }
    return isTuple ? new TupleLiteral(expressions) : expressions[0]
  }

  function parseForStatement(): For | MissingNode {
    // e.g., `message` in `for message in messages`
    const loopVariableStart = current
    const loopVariable = parseExpressionSequence(true) // should be an identifier/tuple
    if (
      !(
        loopVariable instanceof Identifier ||
        loopVariable instanceof TupleLiteral
      ) ||
      loopVariable.identifierName === "in"
    ) {
      const missingNode = createMissingNode(
        "identifier/tuple for the loop variable",
        tokens[loopVariableStart],
        loopVariable,
      )
      eatUntil(TOKEN_TYPES.CloseStatement, "'%}'")
      return missingNode
    }

    let inToken: Token | undefined = undefined
    if (!isIdentifier("in")) {
      createMissingNode("'in' keyword following loop variable", tokens[current])
    } else {
      inToken = tokens[current++]
    }

    // `messages` in `for message in messages`
    const iterable = parseExpression()

    const closeToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")

    // Body of for loop
    const body: Statement[] = []

    // Keep going until we hit {% endfor or {% else
    while (current < tokens.length && !isStatement("else", "endfor")) {
      body.push(parseAny())
    }

    // (Optional) else block
    const alternative: Statement[] = []
    let elseOpenToken: Token | undefined = undefined
    let elseIdentifier: Token | undefined = undefined
    let elseCloseToken: Token | undefined = undefined
    if (isStatement("else")) {
      elseOpenToken = tokens[current++] // consume {%
      elseIdentifier = tokens[current++] // consume 'else'
      elseCloseToken = expect(TOKEN_TYPES.CloseStatement, "'%}'")
      while (current < tokens.length && !isStatement("endfor")) {
        alternative.push(parseAny())
      }
    }

    const result = new For(
      loopVariable,
      iterable,
      body,
      alternative,
      createTokenNode(inToken),
      createTokenNode(elseOpenToken),
      createTokenNode(elseIdentifier),
      createTokenNode(elseCloseToken),
    )
    result.addChild(createTokenNode(closeToken), "closeToken")
    return result
  }

  function parseExpression(): Statement {
    // Choose parse function with lowest precedence
    return parseIfExpression()
  }

  function parseIfExpression(): Statement {
    const a = parseLogicalOrExpression()
    if (isIdentifier("if")) {
      // Ternary expression
      const ifToken = tokens[current++] // consume 'if'
      const test = parseLogicalOrExpression()

      if (isIdentifier("else")) {
        // Ternary expression with else
        const elseToken = tokens[current++] // consume 'else'
        const falseExpr = parseIfExpression() // recurse to support chained ternaries
        return new Ternary(
          test,
          a,
          falseExpr,
          createTokenNode(ifToken),
          createTokenNode(elseToken),
        )
      } else {
        // Select expression on iterable
        return new SelectExpression(a, test, createTokenNode(ifToken))
      }
    }
    return a
  }

  function parseLogicalOrExpression(): Statement {
    let left = parseLogicalAndExpression()
    while (isIdentifier("or")) {
      const operator = tokens[current]
      ++current
      const right = parseLogicalAndExpression()
      left = new BinaryExpression(createTokenNode(operator), left, right)
    }
    return left
  }

  function parseLogicalAndExpression(): Statement {
    let left = parseLogicalNegationExpression()
    while (isIdentifier("and")) {
      const operator = tokens[current]
      ++current
      const right = parseLogicalNegationExpression()
      left = new BinaryExpression(createTokenNode(operator), left, right)
    }
    return left
  }

  function parseLogicalNegationExpression(): Statement {
    let right: UnaryExpression | undefined

    // Try parse unary operators
    while (isIdentifier("not")) {
      // not not ...
      const operator = tokens[current]
      ++current
      const arg = parseLogicalNegationExpression() // not test.x === not (test.x)
      right = new UnaryExpression(createTokenNode(operator), arg)
    }

    return right ?? parseComparisonExpression()
  }

  function parseComparisonExpression(): Statement {
    // NOTE: membership has same precedence as comparison
    // e.g., ('a' in 'apple' == 'b' in 'banana') evaluates as ('a' in ('apple' == ('b' in 'banana')))
    let left = parseAdditiveExpression()
    while (true) {
      let operator: Token
      if (isIdentifier("not", "in")) {
        operator = new Token(
          "not in",
          TOKEN_TYPES.Identifier,
          tokens[current].start,
          tokens[current + 1].end,
        )
        current += 2
      } else if (isIdentifier("in")) {
        operator = tokens[current++]
      } else if (is(TOKEN_TYPES.ComparisonBinaryOperator)) {
        operator = tokens[current++]
      } else {
        break
      }
      const right = parseAdditiveExpression()
      left = new BinaryExpression(createTokenNode(operator), left, right)
    }
    return left
  }
  function parseAdditiveExpression(): Statement {
    let left = parseMultiplicativeExpression()
    while (is(TOKEN_TYPES.AdditiveBinaryOperator)) {
      const operator = tokens[current++]
      const right = parseMultiplicativeExpression()
      left = new BinaryExpression(createTokenNode(operator), left, right)
    }
    return left
  }

  function parseCallMemberExpression(): Statement {
    // Handle member expressions recursively

    const member = parseMemberExpression(parsePrimaryExpression()) // foo.x

    if (is(TOKEN_TYPES.OpenParen)) {
      // foo.x()
      return parseCallExpression(member)
    }
    return member
  }

  function parseCallExpression(callee: Statement): Statement {
    const [openToken, args, closeToken] = parseArgs()
    let expression: Statement = new CallExpression(
      callee,
      args,
      createTokenNode(openToken),
      createTokenNode(closeToken),
    )

    expression = parseMemberExpression(expression) // foo.x().y

    if (is(TOKEN_TYPES.OpenParen)) {
      // foo.x()()
      expression = parseCallExpression(expression)
    }

    return expression
  }

  function parseArgs(): [Token, Statement[], Token] {
    // add (x + 5, foo())
    const openToken = expect(TOKEN_TYPES.OpenParen, "'('")
    let args = []
    let closeToken = createErrorToken()
    if (openToken.type !== "Error") {
      args = parseArgumentsList()
      closeToken = expect(TOKEN_TYPES.CloseParen, "')'")
    }

    return [openToken, args, closeToken]
  }
  function parseArgumentsList(): Statement[] {
    // comma-separated arguments list

    const args = []
    while (current < tokens.length && !is(TOKEN_TYPES.CloseParen)) {
      let argument: Statement

      // unpacking: *expr
      if (
        tokens[current].type === TOKEN_TYPES.MultiplicativeBinaryOperator &&
        tokens[current].value === "*"
      ) {
        const operatorToken = tokens[current++]
        const expr = parseExpression()
        argument = new SpreadExpression(expr, createTokenNode(operatorToken))
      } else {
        const argumentStart = current
        argument = parseExpression()
        if (is(TOKEN_TYPES.Equals)) {
          // keyword argument
          // e.g., func(x = 5, y = a or b)
          const equalsToken = tokens[current++] // consume equals
          if (!(argument instanceof Identifier)) {
            createMissingNode(
              "identifier for keyword argument",
              tokens[argumentStart],
            )
            current--
            eatUntil(TOKEN_TYPES.CloseParen, "')'", false)
            break
          }
          const value = parseExpression()
          argument = new KeywordArgumentExpression(
            argument as Identifier,
            value,
            createTokenNode(equalsToken),
          )
        }
      }
      args.push(argument)
      if (is(TOKEN_TYPES.Comma)) {
        ++current // consume comma
      }
    }
    return args
  }

  function parseMemberExpressionArgumentsList(): Statement {
    // NOTE: This also handles slice expressions colon-separated arguments list
    // e.g., ['test'], [0], [:2], [1:], [1:2], [1:2:3]

    const slices: (Statement | undefined)[] = []
    let isSlice = false
    while (current < tokens.length && !is(TOKEN_TYPES.CloseSquareBracket)) {
      if (is(TOKEN_TYPES.Colon)) {
        // A case where a default is used
        // e.g., [:2] will be parsed as [undefined, 2]
        slices.push(undefined)
        ++current // consume colon
        isSlice = true
      } else {
        slices.push(parseExpression())
        if (is(TOKEN_TYPES.Colon)) {
          ++current // consume colon after expression, if it exists
          isSlice = true
        }
      }
    }
    if (slices.length === 0) {
      // []
      return createMissingNode(
        "at least one argument for member/slice expression",
        tokens[current],
      )
    }

    if (isSlice) {
      if (slices.length > 3) {
        // TODO: this is not really a missing node, but unexpected token(s)
        return createMissingNode(
          "at most three argument for slice expression",
          tokens[current],
        )
      }
      return new SliceExpression(...slices)
    }

    return slices[0] as Statement // normal member expression
  }

  function parseMemberExpression(object: Statement): Statement {
    while (is(TOKEN_TYPES.Dot) || is(TOKEN_TYPES.OpenSquareBracket)) {
      const operator = tokens[current] // . or [
      let closeBracket: TokenNode | undefined = undefined
      ++current
      let property: Statement
      const computed = operator.type === TOKEN_TYPES.OpenSquareBracket
      if (computed) {
        // computed (i.e., bracket notation: obj[expr])
        property = parseMemberExpressionArgumentsList()
        closeBracket = createTokenNode(
          expect(TOKEN_TYPES.CloseSquareBracket, "']'"),
        )
      } else {
        // non-computed (i.e., dot notation: obj.expr)
        const propertyStart = current
        property = parsePrimaryExpression() // should be an identifier
        if (property.type !== "Identifier") {
          property = createMissingNode(
            "identifier for member expression",
            tokens[propertyStart],
            property,
          )
        }
      }
      object = new MemberExpression(
        object,
        property,
        computed,
        createTokenNode(operator),
        closeBracket,
      )
    }
    return object
  }

  function parseMultiplicativeExpression(): Statement {
    let left = parsePowerExpression()
    while (is(TOKEN_TYPES.MultiplicativeBinaryOperator)) {
      const operator = tokens[current++]
      const right = parsePowerExpression()
      left = new BinaryExpression(createTokenNode(operator), left, right)
    }
    return left
  }

  function parsePowerExpression(): Statement {
    let left = parseTestExpression()

    // Power operators have higher precedence than test expressions
    // e.g., (4 ** 4 is divisibleby(2)) evaluates as (4 ** (4 is divisibleby(2)))

    while (is(TOKEN_TYPES.PowerBinaryOperator)) {
      const operator = tokens[current++]
      const right = parseTestExpression()
      left = new BinaryExpression(createTokenNode(operator), left, right)
    }
    return left
  }

  function parseTestExpression(): Statement {
    let operand = parseFilterExpression()

    while (isIdentifier("is")) {
      // Support chaining tests
      const isToken = tokens[current++] // consume is
      let notToken: Token | undefined = undefined
      const negate = isIdentifier("not")
      if (negate) {
        notToken = tokens[current++] // consume not
      }

      const filterStart = current
      let test = parsePrimaryExpression()
      if (!(test instanceof Identifier)) {
        createMissingNode("identifier for the test", tokens[filterStart], test)
        test = new Identifier("error", createTokenNode(tokens[current]))
      }
      // TODO: Add support for non-identifier tests
      operand = new TestExpression(
        operand,
        negate,
        test as Identifier,
        createTokenNode(isToken),
        createTokenNode(notToken),
      )
    }
    return operand
  }

  function parseFilterExpression(): Statement {
    let operand = parseCallMemberExpression()

    while (is(TOKEN_TYPES.Pipe)) {
      // Support chaining filters
      const pipeToken = tokens[current++] // consume pipe
      const filterStart = current
      let filter = parsePrimaryExpression() // should be an identifier
      if (!(filter instanceof Identifier)) {
        createMissingNode(
          "identifier for the filter",
          tokens[filterStart],
          filter,
        )
        filter = new Identifier("error", createTokenNode(tokens[current]))
      }
      if (is(TOKEN_TYPES.OpenParen)) {
        filter = parseCallExpression(filter)
      }
      operand = new FilterExpression(
        operand,
        filter as Identifier | CallExpression,
        createTokenNode(pipeToken),
      )
    }
    return operand
  }

  const primaryExpressionMissingNodes = new Set<number>()
  function parsePrimaryExpression(): Statement {
    // Primary expression: number, string, identifier, function call, parenthesized expression
    const token = current >= tokens.length ? undefined : tokens[current++]
    switch (token?.type) {
      case TOKEN_TYPES.NumericLiteral: {
        const num = token.value
        return num.includes(".") || num.includes("e")
          ? new FloatLiteral(Number(num), createTokenNode(token))
          : new IntegerLiteral(Number(num), createTokenNode(token))
      }
      case TOKEN_TYPES.StringLiteral: {
        const currentTokens = [createTokenNode(token)]
        let value = token.value
        while (is(TOKEN_TYPES.StringLiteral)) {
          currentTokens.push(createTokenNode(tokens[current]))
          value += tokens[current++].value
        }
        return new StringLiteral(value, currentTokens)
      }
      case TOKEN_TYPES.Identifier:
        return new Identifier(token.value, createTokenNode(token))
      case TOKEN_TYPES.OpenParen: {
        const expression = parseExpressionSequence()
        expect(TOKEN_TYPES.CloseParen, "')'")
        return expression
      }
      case TOKEN_TYPES.OpenSquareBracket: {
        const values = []
        while (current < tokens.length && !is(TOKEN_TYPES.CloseSquareBracket)) {
          values.push(parseExpression())

          if (is(TOKEN_TYPES.Comma)) {
            ++current // consume comma
          }
        }
        const closeToken = tokens[current++] // consume closing square bracket

        return new ArrayLiteral(
          values,
          createTokenNode(token),
          createTokenNode(closeToken),
        )
      }
      case TOKEN_TYPES.OpenCurlyBracket: {
        const values = new Map()
        while (current < tokens.length && !is(TOKEN_TYPES.CloseCurlyBracket)) {
          const key = parseExpression()
          expect(TOKEN_TYPES.Colon, "':'")
          const value = parseExpression()
          values.set(key, value)

          if (is(TOKEN_TYPES.Comma)) {
            ++current // consume comma
          }
        }
        const closeToken = tokens[current++] // consume closing curly bracket

        return new ObjectLiteral(
          values,
          createTokenNode(token),
          createTokenNode(closeToken),
        )
      }
      default:
        // Make sure to break from infinite loops, if parsePrimaryExpression is called twice for this token we don't want to continue trying.
        const alreadyCreated = primaryExpressionMissingNodes.has(current)
        primaryExpressionMissingNodes.add(current)
        if (!alreadyCreated) {
          current--
          return createMissingNode("expression", token)
        }
        return new MissingNode("expression", token ?? tokens[tokens.length - 1])
    }
  }

  while (current < tokens.length) {
    const node = parseAny()
    program.body.push(node)
    program.addChild(node)
  }

  if (!safe) {
    if (errors.length !== 0) {
      throw new SyntaxError("Parsing failed")
    }
    return program
  }

  return [program, tokenNodes.sort((a, b) => a.start - b.start), errors]
}
