import type { Token } from "./lexer"

export class Node {
  type = "Node"

  constructor(
    public parent: Node | undefined = undefined,
    public children: Node[] = []
  ) {}

  addChildren(...children: (Node | undefined | null)[]) {
    for (const child of children) {
      if (child !== undefined && child !== null) {
        this.addChild(child)
      }
    }
  }

  addChild(child: Node, name: string | undefined = undefined) {
    if (name !== undefined) {
      // @ts-ignore
      this[name] = child
    }
    child.parent = this
    this.children.push(child)
  }
}

export class TokenNode extends Node {
  override type = "TokenNode"

  constructor(public token: Token) {
    super()
  }

  get value() {
    return this.token.value
  }

  get start() {
    return this.token.start
  }

  get end() {
    return this.token.end
  }
}

export const createTokenNode = (token: Token | undefined) => {
  if (token === undefined) {
    return undefined
  }
  return new TokenNode(token)
}

/**
 * Statements do not result in a value at runtime. They contain one or more expressions internally.
 */
export class Statement extends Node {
  override type = "Statement"

  constructor(
    public openToken: TokenNode | undefined = undefined,
    public closeToken: TokenNode | undefined = undefined,
    public identifier: TokenNode | undefined = undefined,
    public closerOpenToken: TokenNode | undefined = undefined,
    public closerCloseToken: TokenNode | undefined = undefined,
    public closerIdentifier: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(
      openToken,
      closeToken,
      identifier,
      closerOpenToken,
      closerCloseToken,
      closerIdentifier
    )
  }
}

export class ErrorNode extends Statement {
  override type = "ErrorNode"
}

export class MissingNode extends ErrorNode {
  override type = "MissingNode"

  constructor(public missingType: string, public before: Token) {
    super()
  }
}

export class UnexpectedToken extends ErrorNode {
  override type = "UnexpectedToken"

  constructor(public message: string, public token: Token) {
    super()
  }
}

/**
 * Defines a block which contains many statements. Each chat template corresponds to one Program.
 */
export class Program extends Statement {
  override type = "Program"

  constructor(public body: Statement[]) {
    super()
    this.addChildren(...body)
  }
}

export class If extends Statement {
  override type = "If"

  constructor(
    public test: Expression,
    public body: Statement[],
    public alternate: Statement[],
    public elseOpenToken: TokenNode | undefined = undefined,
    public elseIdentifier: TokenNode | undefined = undefined,
    public elseCloseToken: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(
      test,
      ...body,
      ...alternate,
      elseOpenToken,
      elseIdentifier,
      elseCloseToken
    )
  }
}

/**
 * Loop over each item in a sequence
 * https://jinja.palletsprojects.com/en/3.0.x/templates/#for
 */
export class For extends Statement {
  override type = "For"

  constructor(
    public loopvar: Identifier | TupleLiteral,
    public iterable: Expression,
    public body: Statement[],
    public defaultBlock: Statement[], // if no iteration took place
    public inToken: TokenNode | undefined = undefined,
    public elseOpenToken: TokenNode | undefined = undefined,
    public elseIdentifier: TokenNode | undefined = undefined,
    public elseCloseToken: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(
      loopvar,
      iterable,
      ...body,
      ...defaultBlock,
      inToken,
      elseOpenToken,
      elseIdentifier,
      elseCloseToken
    )
  }
}

export class Break extends Statement {
  override type = "Break"
}
export class Continue extends Statement {
  override type = "Continue"
}

export class SetStatement extends Statement {
  override type = "Set"
  constructor(
    public assignee: Expression,
    public value: Expression | null,
    public body: Statement[],
    public equalsToken: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(assignee, value, ...body, equalsToken)
  }
}

export class Raw extends Statement {
  override type = "Raw"

  constructor(public body: Statement[]) {
    super()
    this.addChildren(...body)
  }
}

export class Include extends Statement {
  override type = "Include"

  constructor(public name: StringLiteral) {
    super()
  }
}

export class Macro extends Statement {
  override type = "Macro"

  constructor(
    public name: Identifier,
    public args: Expression[],
    public body: Statement[],
    public openParenToken: TokenNode | undefined = undefined,
    public closeParenToken: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(name, ...args, ...body, openParenToken, closeParenToken)
  }
}

export class Comment extends Statement {
  override type = "Comment"

  constructor(public token: Token, public value: string) {
    super()
  }
}

/**
 * Expressions will result in a value at runtime (unlike statements).
 */
export class Expression extends Statement {
  override type = "Expression"
}

export class MemberExpression extends Expression {
  override type = "MemberExpression"

  constructor(
    public object: Expression,
    public property: Expression,
    public computed: boolean
  ) {
    super()
    this.addChildren(object, property)
  }
}

export class CallExpression extends Expression {
  override type = "CallExpression"

  constructor(
    public callee: Expression,
    public args: Expression[],
    public openParenToken: TokenNode | undefined = undefined,
    public closeParenToken: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(callee, ...args, openParenToken, closeParenToken)
  }
}

/**
 * Represents a user-defined variable or symbol in the template.
 */
export class Identifier extends Expression {
  override type = "Identifier"

  /**
   * @param {string} value The name of the identifier
   */
  constructor(public value: string, public token: TokenNode) {
    super()
    this.addChildren(token)
  }
}

/**
 * Abstract base class for all Literal expressions.
 * Should not be instantiated directly.
 */
abstract class Literal<T> extends Expression {
  override type = "Literal"

  constructor(public value: T) {
    super()
  }
}

export class IntegerLiteral extends Literal<number> {
  override type = "IntegerLiteral"

  constructor(public value: number, public token: TokenNode) {
    super(value)
    this.addChildren(token)
  }
}

export class FloatLiteral extends Literal<number> {
  override type = "FloatLiteral"

  constructor(public value: number, public token: TokenNode) {
    super(value)
    this.addChildren(token)
  }
}

/**
 * Represents a text constant in the template.
 */
export class StringLiteral extends Literal<string> {
  override type = "StringLiteral"

  constructor(public value: string, public tokens: TokenNode[]) {
    super(value)
    this.addChildren(...tokens)
  }
}

/**
 * Represents an array literal in the template.
 */
export class ArrayLiteral extends Literal<Expression[]> {
  override type = "ArrayLiteral"

  constructor(
    public value: Expression[],
    public openBracketToken: TokenNode,
    public closeBracketToken: TokenNode
  ) {
    super(value)
    this.addChildren(...value, openBracketToken, closeBracketToken)
  }
}

/**
 * Represents a tuple literal in the template.
 */
export class TupleLiteral extends Literal<Expression[]> {
  override type = "TupleLiteral"
}

/**
 * Represents an object literal in the template.
 */
export class ObjectLiteral extends Literal<Map<Expression, Expression>> {
  override type = "ObjectLiteral"

  constructor(
    public value: Map<Expression, Expression>,
    public openBracketToken: TokenNode,
    public closeBracketToken: TokenNode
  ) {
    super(value)
    this.addChildren(
      ...value.keys(),
      ...value.values(),
      openBracketToken,
      closeBracketToken
    )
  }
}

/**
 * An operation with two sides, separated by an operator.
 * Note: Either side can be a Complex Expression, with order
 * of operations being determined by the operator.
 */
export class BinaryExpression extends Expression {
  override type = "BinaryExpression"

  constructor(
    public operator: TokenNode,
    public left: Expression,
    public right: Expression
  ) {
    super()
    this.addChildren(operator, left, right)
  }
}

/**
 * An operation with two sides, separated by the | operator.
 * Operator precedence: https://github.com/pallets/jinja/issues/379#issuecomment-168076202
 */
export class FilterExpression extends Expression {
  override type = "FilterExpression"

  constructor(
    public operand: Expression,
    public filter: Identifier | CallExpression,
    public pipeToken: TokenNode
  ) {
    super()
    this.addChildren(operand, filter, pipeToken)
  }
}

export class FilterStatement extends Statement {
  override type = "FilterStatement"

  constructor(
    public filter: Identifier | CallExpression,
    public body: Statement[]
  ) {
    super()
    this.addChildren(filter, ...body)
  }
}

/**
 * An operation which filters a sequence of objects by applying a test to each object,
 * and only selecting the objects with the test succeeding.
 *
 * It may also be used as a shortcut for a ternary operator.
 */
export class SelectExpression extends Expression {
  override type = "SelectExpression"

  constructor(
    public lhs: Expression,
    public test: Expression,
    public ifToken: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(lhs, test, ifToken)
  }
}

/**
 * An operation with two sides, separated by the "is" operator.
 */
export class TestExpression extends Expression {
  override type = "TestExpression"

  constructor(
    public operand: Expression,
    public negate: boolean,
    public test: Identifier, // TODO: Add support for non-identifier tests
    public isToken: TokenNode,
    public notToken: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(operand, test, isToken, notToken)
  }
}

/**
 * An operation with one side (operator on the left).
 */
export class UnaryExpression extends Expression {
  override type = "UnaryExpression"

  constructor(public operator: TokenNode, public argument: Expression) {
    super()
    this.addChildren(operator, argument)
  }
}

export class SliceExpression extends Expression {
  override type = "SliceExpression"

  constructor(
    public start: Expression | undefined = undefined,
    public stop: Expression | undefined = undefined,
    public step: Expression | undefined = undefined
  ) {
    super()
    this.addChildren(start, stop, step)
  }
}

export class KeywordArgumentExpression extends Expression {
  override type = "KeywordArgumentExpression"

  constructor(
    public key: Identifier,
    public value: Expression,
    public equalsToken: TokenNode
  ) {
    super()
    this.addChildren(key, value, equalsToken)
  }
}

export class SpreadExpression extends Expression {
  override type = "SpreadExpression"

  constructor(public argument: Expression, public operatorToken: TokenNode) {
    super()
    this.addChildren(argument, operatorToken)
  }
}

export class CallStatement extends Statement {
  override type = "CallStatement"

  constructor(
    public call: CallExpression,
    public callerArgs: Expression[] | null,
    public body: Statement[],
    public openParenToken: TokenNode | undefined = undefined,
    public closeParenToken: TokenNode | undefined = undefined
  ) {
    super()
    this.addChildren(
      call,
      ...(callerArgs ?? []),
      ...body,
      openParenToken,
      closeParenToken
    )
  }
}

export class Ternary extends Expression {
  override type = "Ternary"
  constructor(
    public condition: Expression,
    public trueExpr: Expression,
    public falseExpr: Expression,
    public ifToken: TokenNode,
    public elseToken: TokenNode
  ) {
    super()
    this.addChildren(condition, trueExpr, falseExpr, ifToken, elseToken)
  }
}
