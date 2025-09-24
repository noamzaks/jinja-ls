import type { Statement } from "./ast"
import {
  ArrayLiteral,
  BinaryExpression,
  Break,
  CallExpression,
  CallStatement,
  Comment,
  Continue,
  createTokenNode,
  FilterExpression,
  FilterStatement,
  FloatLiteral,
  For,
  Identifier,
  If,
  IntegerLiteral,
  KeywordArgumentExpression,
  Macro,
  MemberExpression,
  ObjectLiteral,
  Program,
  SelectExpression,
  SetStatement,
  SliceExpression,
  SpreadExpression,
  StringLiteral,
  Ternary,
  TestExpression,
  TokenNode,
  TupleLiteral,
  UnaryExpression,
} from "./ast"
import { ParserError } from "./errors"
import type { TokenType } from "./lexer"
import { Token, TOKEN_TYPES } from "./lexer"

/**
 * Generate the Abstract Syntax Tree (AST) from a list of tokens.
 * Operator precedence can be found here: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence#table
 */
export function parse(tokens: Token[]): Program {
  const program = new Program([])
  let current = 0

  /**
   * Consume the next token if it matches the expected type, otherwise throw an error.
   * @param type The expected token type
   * @param error The error message to throw if the token does not match the expected type
   * @returns The consumed token
   */
  function expect(type: string, error: string): Token {
    const prev = tokens[current++]
    if (!prev || prev.type !== type) {
      throw new ParserError(
        `Parser Error: ${error}. ${prev.type} !== ${type}.`,
        tokens[current - 1].start,
        tokens[current - 1].end
      )
    }
    return prev
  }

  function expectIdentifier(name: string): Token {
    if (!isIdentifier(name)) {
      throw new ParserError(
        `Expected ${name}`,
        tokens[current].start,
        tokens[current].end
      )
    }
    return tokens[current++]
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
        throw new ParserError(
          `Unexpected token type: ${tokens[current].type}`,
          tokens[current].start,
          tokens[current].end
        )
    }
  }

  function is(...types: TokenType[]): boolean {
    return (
      current + types.length <= tokens.length &&
      types.every((type, i) => type === tokens[current + i].type)
    )
  }

  function isStatement(...names: string[]): boolean {
    if (current >= tokens.length) {
      throw new ParserError(
        `Missing ${names.at(-1)} statement`,
        tokens[tokens.length - 1].end,
        tokens[tokens.length - 1].end
      )
    }

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
          name === tokens[current + i].value
      )
    )
  }

  function parseText(): StringLiteral {
    const token = expect(TOKEN_TYPES.Text, "Expected text token")
    return new StringLiteral(token.value, [new TokenNode(token)])
  }

  function parseJinjaStatement(): Statement {
    // Consume {% token
    const openToken = expect(
      TOKEN_TYPES.OpenStatement,
      "Expected opening statement token"
    )
    let closeToken: Token | undefined = undefined

    // next token must be Identifier whose .value tells us which statement
    if (tokens[current].type !== TOKEN_TYPES.Identifier) {
      throw new ParserError(
        `Unknown statement, got ${tokens[current].type}`,
        tokens[current].start,
        tokens[current].end
      )
    }
    const identifier = tokens[current]
    const name = tokens[current].value
    let result: Statement
    switch (name) {
      case "set":
        ++current
        result = parseSetStatement()
        break
      case "if":
        ++current
        result = parseIfStatement()
        // expect {% endif %}
        result.addChild(
          new TokenNode(expect(TOKEN_TYPES.OpenStatement, "Expected {% token")),
          "closerOpenToken"
        )
        result.addChild(
          new TokenNode(expectIdentifier("endif")),
          "closerIdentifier"
        )
        result.addChild(
          new TokenNode(
            expect(TOKEN_TYPES.CloseStatement, "Expected %} token")
          ),
          "closerCloseToken"
        )
        break
      case "macro":
        ++current
        result = parseMacroStatement()
        // expect {% endmacro %}
        result.addChild(
          new TokenNode(expect(TOKEN_TYPES.OpenStatement, "Expected {% token")),
          "closerOpenToken"
        )
        result.addChild(
          new TokenNode(expectIdentifier("endmacro")),
          "closerIdentifier"
        )
        result.addChild(
          new TokenNode(
            expect(TOKEN_TYPES.CloseStatement, "Expected %} token")
          ),
          "closerCloseToken"
        )
        break
      case "for":
        ++current
        result = parseForStatement()
        // expect {% endfor %}
        result.addChild(
          new TokenNode(expect(TOKEN_TYPES.OpenStatement, "Expected {% token")),
          "closerOpenToken"
        )
        result.addChild(
          new TokenNode(expectIdentifier("endfor")),
          "closerIdentifier"
        )
        result.addChild(
          new TokenNode(
            expect(TOKEN_TYPES.CloseStatement, "Expected %} token")
          ),
          "closerCloseToken"
        )
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
          throw new ParserError(
            `Expected identifier following call statement`,
            tokens[calleeStart].start,
            tokens[current - 1].end
          )
        }
        const [callOpenParen, callArgs, callCloseParen] = parseArgs()
        closeToken = expect(
          TOKEN_TYPES.CloseStatement,
          "Expected closing statement token"
        )
        const body: Statement[] = []
        while (!isStatement("endcall")) {
          body.push(parseAny())
        }
        const callExpr = new CallExpression(
          callee,
          callArgs,
          new TokenNode(callOpenParen),
          new TokenNode(callCloseParen)
        )
        result = new CallStatement(
          callExpr,
          callerArgs?.[1] ?? null,
          body,
          createTokenNode(callerArgs?.[0]),
          createTokenNode(callerArgs?.[2])
        )
        result.addChild(
          new TokenNode(expect(TOKEN_TYPES.OpenStatement, "Expected '{%'")),
          "closerOpenToken"
        )
        result.addChild(
          new TokenNode(expectIdentifier("endcall")),
          "closerIdentifier"
        )
        result.addChild(
          new TokenNode(
            expect(
              TOKEN_TYPES.CloseStatement,
              "Expected closing statement token"
            )
          ),
          "closerCloseToken"
        )
        break
      }
      case "break":
        ++current
        closeToken = expect(
          TOKEN_TYPES.CloseStatement,
          "Expected closing statement token"
        )
        result = new Break()
        break
      case "continue":
        ++current
        closeToken = expect(
          TOKEN_TYPES.CloseStatement,
          "Expected closing statement token"
        )
        result = new Continue()
        break
      case "filter": {
        ++current // consume 'filter'
        let filterNode = parsePrimaryExpression()
        if (filterNode instanceof Identifier && is(TOKEN_TYPES.OpenParen)) {
          filterNode = parseCallExpression(filterNode)
        }
        closeToken = expect(
          TOKEN_TYPES.CloseStatement,
          "Expected closing statement token"
        )
        const filterBody: Statement[] = []
        while (!isStatement("endfilter")) {
          filterBody.push(parseAny())
        }
        result = new FilterStatement(
          filterNode as Identifier | CallExpression,
          filterBody
        )

        result.addChild(
          new TokenNode(expect(TOKEN_TYPES.OpenStatement, "Expected '{%'")),
          "closerOpenToken"
        )
        result.addChild(
          new TokenNode(expectIdentifier("endfilter")),
          "closerIdentifier"
        )
        result.addChild(
          new TokenNode(expect(TOKEN_TYPES.CloseStatement, "Expected '%}'")),
          "closerCloseToken"
        )
        break
      }
      default:
        throw new ParserError(
          `Unknown statement type: ${name}`,
          tokens[current].start,
          tokens[current].end
        )
    }
    result.addChild(new TokenNode(openToken), "openToken")
    result.addChild(new TokenNode(identifier), "identifier")
    if (closeToken) {
      result.addChild(new TokenNode(closeToken), "closeToken")
    }

    return result
  }

  function parseJinjaExpression(): Statement {
    // Consume {{ }} tokens
    const openToken = expect(
      TOKEN_TYPES.OpenExpression,
      "Expected opening expression token"
    )

    const result = parseExpression()
    result.addChild(new TokenNode(openToken), "openToken")

    result.addChild(
      new TokenNode(
        expect(TOKEN_TYPES.CloseExpression, "Expected closing expression token")
      ),
      "closeToken"
    )

    return result
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
      closeToken = expect(TOKEN_TYPES.CloseStatement, "Expected %} token")
      while (!isStatement("endset")) {
        body.push(parseAny())
      }
      closerOpenToken = expect(TOKEN_TYPES.OpenStatement, "Expected {% token")
      closerIdentifier = expectIdentifier("endset")
    }
    const result = new SetStatement(
      left,
      value,
      body,
      createTokenNode(equalsToken)
    )
    if (closeToken) {
      result.addChild(new TokenNode(closeToken), "closeToken")
      result.addChild(new TokenNode(closerOpenToken!), "closerOpenToken")
      result.addChild(new TokenNode(closerIdentifier!), "closerIdentifier")
      result.addChild(
        new TokenNode(
          expect(TOKEN_TYPES.CloseStatement, "Expected closing statement token")
        ),
        "closerCloseToken"
      )
    } else {
      result.addChild(
        new TokenNode(
          expect(TOKEN_TYPES.CloseStatement, "Expected closing statement token")
        ),
        "closeToken"
      )
    }
    return result
  }

  function parseIfStatement(): If {
    const test = parseExpression()

    test.addChild(
      new TokenNode(
        expect(TOKEN_TYPES.CloseStatement, "Expected closing statement token")
      ),
      "closeToken"
    )

    const body: Statement[] = []
    const alternate: Statement[] = []

    // Keep parsing 'if' body until we reach the first {% elif %} or {% else %} or {% endif %}
    while (!isStatement("elif", "else", "endif")) {
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
      result.addChild(new TokenNode(elifOpenToken), "openToken")
      result.addChild(new TokenNode(elifIdentifier), "identifier")
      alternate.push(result)
    }
    // handle {% else %}
    else if (isStatement("else")) {
      elseOpenToken = tokens[current]
      ++current // consume {%
      elseIdentifier = tokens[current]
      ++current // consume 'else'
      elseCloseToken = expect(
        TOKEN_TYPES.CloseStatement,
        "Expected closing statement token"
      )

      // keep going until we hit {% endif %}
      while (!isStatement("endif")) {
        alternate.push(parseAny())
      }
    }

    return new If(
      test,
      body,
      alternate,
      createTokenNode(elseOpenToken),
      createTokenNode(elseIdentifier),
      createTokenNode(elseCloseToken)
    )
  }

  function parseMacroStatement(): Macro {
    const nameStart = current
    const name = parsePrimaryExpression()
    if (name.type !== "Identifier") {
      throw new ParserError(
        `Expected identifier following macro statement`,
        tokens[nameStart].start,
        tokens[current - 1].end
      )
    }
    const [argsOpenParen, args, argsCloseParen] = parseArgs()
    const closeToken = expect(
      TOKEN_TYPES.CloseStatement,
      "Expected closing statement token"
    )

    // Body of macro
    const body: Statement[] = []

    // Keep going until we hit {% endmacro
    while (!isStatement("endmacro")) {
      body.push(parseAny())
    }

    const result = new Macro(
      name as Identifier,
      args,
      body,
      createTokenNode(argsOpenParen),
      createTokenNode(argsCloseParen)
    )
    result.addChild(new TokenNode(closeToken), "closeToken")
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

  function parseForStatement(): For {
    // e.g., `message` in `for message in messages`
    const loopVariableStart = current
    const loopVariable = parseExpressionSequence(true) // should be an identifier/tuple
    if (
      !(
        loopVariable instanceof Identifier ||
        loopVariable instanceof TupleLiteral
      )
    ) {
      throw new ParserError(
        `Expected identifier/tuple for the loop variable, got ${loopVariable.type} instead`,
        tokens[loopVariableStart].start,
        tokens[current - 1].end
      )
    }

    if (!isIdentifier("in")) {
      throw new ParserError(
        "Expected `in` keyword following loop variable",
        tokens[current].start,
        tokens[current].end
      )
    }
    const inToken = tokens[current++]

    // `messages` in `for message in messages`
    const iterable = parseExpression()

    const closeToken = expect(
      TOKEN_TYPES.CloseStatement,
      "Expected closing statement token"
    )

    // Body of for loop
    const body: Statement[] = []

    // Keep going until we hit {% endfor or {% else
    while (!isStatement("else", "endfor")) {
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
      elseCloseToken = expect(
        TOKEN_TYPES.CloseStatement,
        "Expected closing statement token"
      )
      while (!isStatement("endfor")) {
        alternative.push(parseAny())
      }
    }

    const result = new For(
      loopVariable,
      iterable,
      body,
      alternative,
      new TokenNode(inToken),
      createTokenNode(elseOpenToken),
      createTokenNode(elseIdentifier),
      createTokenNode(elseCloseToken)
    )
    result.addChild(new TokenNode(closeToken), "closeToken")
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
          new TokenNode(ifToken),
          new TokenNode(elseToken)
        )
      } else {
        // Select expression on iterable
        return new SelectExpression(a, test, new TokenNode(ifToken))
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
      left = new BinaryExpression(new TokenNode(operator), left, right)
    }
    return left
  }

  function parseLogicalAndExpression(): Statement {
    let left = parseLogicalNegationExpression()
    while (isIdentifier("and")) {
      const operator = tokens[current]
      ++current
      const right = parseLogicalNegationExpression()
      left = new BinaryExpression(new TokenNode(operator), left, right)
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
      right = new UnaryExpression(new TokenNode(operator), arg)
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
          tokens[current + 1].end
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
      left = new BinaryExpression(new TokenNode(operator), left, right)
    }
    return left
  }
  function parseAdditiveExpression(): Statement {
    let left = parseMultiplicativeExpression()
    while (is(TOKEN_TYPES.AdditiveBinaryOperator)) {
      const operator = tokens[current]
      ++current
      const right = parseMultiplicativeExpression()
      left = new BinaryExpression(new TokenNode(operator), left, right)
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
      new TokenNode(openToken),
      new TokenNode(closeToken)
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
    const openToken = expect(
      TOKEN_TYPES.OpenParen,
      "Expected opening parenthesis for arguments list"
    )

    const args = parseArgumentsList()

    const closeToken = expect(
      TOKEN_TYPES.CloseParen,
      "Expected closing parenthesis for arguments list"
    )
    return [openToken, args, closeToken]
  }
  function parseArgumentsList(): Statement[] {
    // comma-separated arguments list

    const args = []
    while (!is(TOKEN_TYPES.CloseParen)) {
      let argument: Statement

      // unpacking: *expr
      if (
        tokens[current].type === TOKEN_TYPES.MultiplicativeBinaryOperator &&
        tokens[current].value === "*"
      ) {
        const operatorToken = tokens[current++]
        const expr = parseExpression()
        argument = new SpreadExpression(expr, new TokenNode(operatorToken))
      } else {
        const argumentStart = current
        argument = parseExpression()
        if (is(TOKEN_TYPES.Equals)) {
          // keyword argument
          // e.g., func(x = 5, y = a or b)
          const equalsToken = tokens[current++] // consume equals
          if (!(argument instanceof Identifier)) {
            throw new ParserError(
              `Expected identifier for keyword argument`,
              tokens[argumentStart].start,
              tokens[current - 1].end
            )
          }
          const value = parseExpression()
          argument = new KeywordArgumentExpression(
            argument as Identifier,
            value,
            new TokenNode(equalsToken)
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

    const startToken = current - 1
    const slices: (Statement | undefined)[] = []
    let isSlice = false
    while (!is(TOKEN_TYPES.CloseSquareBracket)) {
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
      throw new ParserError(
        `Expected at least one argument for member/slice expression`,
        tokens[startToken].start,
        tokens[current].end
      )
    }

    if (isSlice) {
      if (slices.length > 3) {
        throw new ParserError(
          `Expected 0-3 arguments for slice expression`,
          tokens[startToken].start,
          tokens[current].end
        )
      }
      return new SliceExpression(...slices)
    }

    return slices[0] as Statement // normal member expression
  }

  function parseMemberExpression(object: Statement): Statement {
    while (is(TOKEN_TYPES.Dot) || is(TOKEN_TYPES.OpenSquareBracket)) {
      const operator = tokens[current] // . or [
      ++current
      let property: Statement
      const computed = operator.type === TOKEN_TYPES.OpenSquareBracket
      if (computed) {
        // computed (i.e., bracket notation: obj[expr])
        property = parseMemberExpressionArgumentsList()
        expect(
          TOKEN_TYPES.CloseSquareBracket,
          "Expected closing square bracket"
        )
      } else {
        // non-computed (i.e., dot notation: obj.expr)
        const propertyStart = current
        property = parsePrimaryExpression() // should be an identifier
        if (property.type !== "Identifier") {
          throw new ParserError(
            `Expected identifier following dot operator`,
            tokens[propertyStart].start,
            tokens[current - 1].end
          )
        }
      }
      object = new MemberExpression(object, property, computed)
    }
    return object
  }

  function parseMultiplicativeExpression(): Statement {
    let left = parseTestExpression()

    // Multiplicative operators have higher precedence than test expressions
    // e.g., (4 * 4 is divisibleby(2)) evaluates as (4 * (4 is divisibleby(2)))

    while (is(TOKEN_TYPES.MultiplicativeBinaryOperator)) {
      const operator = tokens[current++]
      const right = parseTestExpression()
      left = new BinaryExpression(new TokenNode(operator), left, right)
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
      const filter = parsePrimaryExpression()
      if (!(filter instanceof Identifier)) {
        throw new ParserError(
          `Expected identifier for the test`,
          tokens[filterStart].start,
          tokens[current - 1].end
        )
      }
      // TODO: Add support for non-identifier tests
      operand = new TestExpression(
        operand,
        negate,
        filter,
        new TokenNode(isToken),
        createTokenNode(notToken)
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
        throw new ParserError(
          `Expected identifier for the filter`,
          tokens[filterStart].start,
          tokens[current - 1].end
        )
      }
      if (is(TOKEN_TYPES.OpenParen)) {
        filter = parseCallExpression(filter)
      }
      operand = new FilterExpression(
        operand,
        filter as Identifier | CallExpression,
        new TokenNode(pipeToken)
      )
    }
    return operand
  }

  function parsePrimaryExpression(): Statement {
    // Primary expression: number, string, identifier, function call, parenthesized expression
    const token = tokens[current++]
    switch (token.type) {
      case TOKEN_TYPES.NumericLiteral: {
        const num = token.value
        return num.includes(".")
          ? new FloatLiteral(Number(num), new TokenNode(token))
          : new IntegerLiteral(Number(num), new TokenNode(token))
      }
      case TOKEN_TYPES.StringLiteral: {
        const currentTokens = [new TokenNode(token)]
        let value = token.value
        while (is(TOKEN_TYPES.StringLiteral)) {
          currentTokens.push(new TokenNode(tokens[current]))
          value += tokens[current++].value
        }
        return new StringLiteral(value, currentTokens)
      }
      case TOKEN_TYPES.Identifier:
        return new Identifier(token.value, new TokenNode(token))
      case TOKEN_TYPES.OpenParen: {
        const expression = parseExpressionSequence()
        expect(
          TOKEN_TYPES.CloseParen,
          "Expected closing parenthesis, got ${tokens[current].type} instead."
        )
        return expression
      }
      case TOKEN_TYPES.OpenSquareBracket: {
        const values = []
        while (!is(TOKEN_TYPES.CloseSquareBracket)) {
          values.push(parseExpression())

          if (is(TOKEN_TYPES.Comma)) {
            ++current // consume comma
          }
        }
        const closeToken = tokens[current++] // consume closing square bracket

        return new ArrayLiteral(
          values,
          new TokenNode(token),
          new TokenNode(closeToken)
        )
      }
      case TOKEN_TYPES.OpenCurlyBracket: {
        const values = new Map()
        while (!is(TOKEN_TYPES.CloseCurlyBracket)) {
          const key = parseExpression()
          expect(
            TOKEN_TYPES.Colon,
            "Expected colon between key and value in object literal"
          )
          const value = parseExpression()
          values.set(key, value)

          if (is(TOKEN_TYPES.Comma)) {
            ++current // consume comma
          }
        }
        const closeToken = tokens[current++] // consume closing curly bracket

        return new ObjectLiteral(
          values,
          new TokenNode(token),
          new TokenNode(closeToken)
        )
      }
      default:
        throw new ParserError(
          `Unexpected token: ${token.type}`,
          token.start,
          token.end
        )
    }
  }

  while (current < tokens.length) {
    const node = parseAny()
    program.body.push(node)
    program.addChild(node)
  }

  return program
}
