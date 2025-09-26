/**
 * Represents tokens that our language understands in parsing.
 */
export const TOKEN_TYPES = Object.freeze({
  Text: "Text", // The text between Jinja statements or expressions

  NumericLiteral: "NumericLiteral", // e.g., 123, 1.0
  StringLiteral: "StringLiteral", // 'string'
  Identifier: "Identifier", // Variables, functions, statements, booleans, etc.
  Equals: "Equals", // =
  OpenParen: "OpenParen", // (
  CloseParen: "CloseParen", // )
  OpenStatement: "OpenStatement", // {%
  CloseStatement: "CloseStatement", // %}
  OpenExpression: "OpenExpression", // {{
  CloseExpression: "CloseExpression", // }}
  OpenSquareBracket: "OpenSquareBracket", // [
  CloseSquareBracket: "CloseSquareBracket", // ]
  OpenCurlyBracket: "OpenCurlyBracket", // {
  CloseCurlyBracket: "CloseCurlyBracket", // }
  Comma: "Comma", // ,
  Dot: "Dot", // .
  Colon: "Colon", // :
  Pipe: "Pipe", // |

  CallOperator: "CallOperator", // ()
  AdditiveBinaryOperator: "AdditiveBinaryOperator", // + - ~
  MultiplicativeBinaryOperator: "MultiplicativeBinaryOperator", // * / %
  ComparisonBinaryOperator: "ComparisonBinaryOperator", // < > <= >= == !=
  UnaryOperator: "UnaryOperator", // ! - +
  Comment: "Comment", // {# ... #}

  Error: "Error",
})

export type TokenType = keyof typeof TOKEN_TYPES

/**
 * Represents a single token in the template.
 */
export class Token {
  /**
   * Constructs a new Token.
   * @param {string} value The raw value as seen inside the source code.
   * @param {TokenType} type The type of token.
   * @param {number} start The start offset of the token.
   * @param {number} end The end offset of the token.
   */
  constructor(
    public value: string,
    public type: TokenType,
    public start: number,
    public end: number
  ) {}
}

export class LexerError {
  constructor(
    public message: string,
    public start: number,
    public end: number
  ) {}
}

function isWord(char: string): boolean {
  return /\w/.test(char)
}

function isInteger(char: string): boolean {
  return /[0-9]/.test(char)
}

/**
 * A data structure which contains a list of rules to test
 */
const ORDERED_MAPPING_TABLE: [string, TokenType][] = [
  // Control sequences
  ["{%-", TOKEN_TYPES.OpenStatement],
  ["-%}", TOKEN_TYPES.CloseStatement],
  ["{{-", TOKEN_TYPES.OpenExpression],
  ["-}}", TOKEN_TYPES.CloseExpression],
  ["{%+", TOKEN_TYPES.OpenStatement],
  ["+%}", TOKEN_TYPES.CloseStatement],
  ["{{+", TOKEN_TYPES.OpenExpression],
  ["+}}", TOKEN_TYPES.CloseExpression],
  ["{%", TOKEN_TYPES.OpenStatement],
  ["%}", TOKEN_TYPES.CloseStatement],
  ["{{", TOKEN_TYPES.OpenExpression],
  ["}}", TOKEN_TYPES.CloseExpression],
  // Single character tokens
  ["(", TOKEN_TYPES.OpenParen],
  [")", TOKEN_TYPES.CloseParen],
  ["{", TOKEN_TYPES.OpenCurlyBracket],
  ["}", TOKEN_TYPES.CloseCurlyBracket],
  ["[", TOKEN_TYPES.OpenSquareBracket],
  ["]", TOKEN_TYPES.CloseSquareBracket],
  [",", TOKEN_TYPES.Comma],
  [".", TOKEN_TYPES.Dot],
  [":", TOKEN_TYPES.Colon],
  ["|", TOKEN_TYPES.Pipe],
  // Comparison operators
  ["<=", TOKEN_TYPES.ComparisonBinaryOperator],
  [">=", TOKEN_TYPES.ComparisonBinaryOperator],
  ["==", TOKEN_TYPES.ComparisonBinaryOperator],
  ["!=", TOKEN_TYPES.ComparisonBinaryOperator],
  ["<", TOKEN_TYPES.ComparisonBinaryOperator],
  [">", TOKEN_TYPES.ComparisonBinaryOperator],
  // Arithmetic operators
  ["+", TOKEN_TYPES.AdditiveBinaryOperator],
  ["-", TOKEN_TYPES.AdditiveBinaryOperator],
  ["~", TOKEN_TYPES.AdditiveBinaryOperator],
  ["*", TOKEN_TYPES.MultiplicativeBinaryOperator],
  ["/", TOKEN_TYPES.MultiplicativeBinaryOperator],
  ["%", TOKEN_TYPES.MultiplicativeBinaryOperator],
  // Assignment operator
  ["=", TOKEN_TYPES.Equals],
]

const ESCAPE_CHARACTERS = new Map([
  ["n", "\n"], // New line
  ["t", "\t"], // Horizontal tab
  ["r", "\r"], // Carriage return
  ["b", "\b"], // Backspace
  ["f", "\f"], // Form feed
  ["v", "\v"], // Vertical tab
  ["'", "'"], // Single quote
  ['"', '"'], // Double quote
  ["\\", "\\"], // Backslash
])

export interface PreprocessOptions {
  trim_blocks?: boolean
  lstrip_blocks?: boolean
}

/**
 * Generate a list of tokens from a source string.
 */
export function tokenize(source: string): Token[]
export function tokenize(source: string, options: PreprocessOptions): Token[]
export function tokenize(
  source: string,
  options: PreprocessOptions,
  safe: false
): Token[]
export function tokenize(
  source: string,
  options: PreprocessOptions,
  safe: true
): [Token[], LexerError[]]
export function tokenize(
  source: string,
  options: PreprocessOptions = {},
  safe = false
): Token[] | [Token[], LexerError[]] {
  const tokens: Token[] = []
  const errors: LexerError[] = []

  let cursorPosition = 0
  let previousCursorPosition = 0
  let curlyBracketDepth = 0

  const createToken = (value: string, type: TokenType) => {
    const result = new Token(
      value,
      type,
      previousCursorPosition,
      cursorPosition
    )
    previousCursorPosition = cursorPosition
    const match = /^[ \t]+/.exec(source.slice(previousCursorPosition))
    if (match) {
      previousCursorPosition += match[0].length
    }
    return result
  }

  const consumeWhile = (
    predicate: (char: string) => boolean,
    label?: string
  ): string => {
    let str = ""
    while (predicate(source[cursorPosition])) {
      // Check for escaped characters
      if (source[cursorPosition] === "\\") {
        // Consume the backslash
        ++cursorPosition
        // Check for end of input
        if (cursorPosition >= source.length) {
          errors.push(
            new LexerError(
              "Missing escaped character",
              cursorPosition - 1,
              source.length
            )
          )
          return str
        }

        // Add the escaped character
        const escaped = source[cursorPosition++]
        const unescaped = ESCAPE_CHARACTERS.get(escaped)
        if (unescaped === undefined) {
          errors.push(
            new LexerError(
              `Invalid escaped character: ${escaped}`,
              cursorPosition - 2,
              cursorPosition
            )
          )
          return str
        }
        str += unescaped
        continue
      }

      str += source[cursorPosition++]
      if (cursorPosition >= source.length) {
        if (label) {
          errors.push(new LexerError(label, cursorPosition - 1, source.length))
        }
        return str
      }
    }
    return str
  }

  // Build each token until end of input
  main: while (cursorPosition < source.length) {
    // First, consume all text that is outside of a Jinja statement or expression
    const lastTokenType = tokens.at(-1)?.type
    if (
      lastTokenType === undefined ||
      lastTokenType === TOKEN_TYPES.CloseStatement ||
      lastTokenType === TOKEN_TYPES.CloseExpression ||
      lastTokenType === TOKEN_TYPES.Comment
    ) {
      let text = ""
      while (
        cursorPosition < source.length &&
        // Keep going until we hit the next Jinja statement or expression
        !(
          source[cursorPosition] === "{" &&
          (source[cursorPosition + 1] === "%" ||
            source[cursorPosition + 1] === "{" ||
            source[cursorPosition + 1] === "#")
        )
      ) {
        // Consume text
        text += source[cursorPosition++]
      }

      // There is some text to add
      if (text.length > 0) {
        // Handle whitespace control
        if (tokens.at(-1)?.value?.startsWith("-")) {
          text = text.trimStart()
        }
        if (source[cursorPosition + 2] === "-") {
          text = text.trimEnd()
        }
        if (
          cursorPosition === source.length &&
          text[text.length - 1] === "\n"
        ) {
          text = text.slice(0, -1)
        }
        if (
          options.lstrip_blocks &&
          (source[cursorPosition + 1] === "%" ||
            source[cursorPosition + 1] === "#")
        ) {
          const lastLineIndex = text.lastIndexOf("\n")
          if (/^[ \t]*$/.test(text.slice(lastLineIndex + 1))) {
            text = text.slice(0, lastLineIndex + 1)
          }
        }

        tokens.push(createToken(text, TOKEN_TYPES.Text))
        continue
      }
    }

    // Possibly consume a comment
    if (source[cursorPosition] === "{" && source[cursorPosition + 1] === "#") {
      cursorPosition += 2 // Skip the opening {#

      let comment = ""
      while (
        source[cursorPosition] !== "#" ||
        source[cursorPosition + 1] !== "}"
      ) {
        // Check for end of input
        if (cursorPosition + 2 >= source.length) {
          errors.push(
            new LexerError(
              "Missing end of comment tag",
              source.length,
              source.length
            )
          )
        }
        comment += source[cursorPosition++]
      }
      cursorPosition += 2 // Skip the closing #}
      tokens.push(createToken(comment, TOKEN_TYPES.Comment))

      // Handle whitespace control
      if (options.trim_blocks && source[cursorPosition] === "\n") {
        ++cursorPosition
      }

      continue
    }

    // Consume (and ignore) all whitespace inside Jinja statements or expressions
    consumeWhile((char) => /\s/.test(char))
    if (cursorPosition >= source.length) {
      continue
    }

    // Handle multi-character tokens
    const char = source[cursorPosition]

    // Check for unary operators
    if (char === "-" || char === "+") {
      const lastTokenType = tokens.at(-1)?.type
      if (lastTokenType === TOKEN_TYPES.Text || lastTokenType === undefined) {
        errors.push(
          new LexerError(
            `Unexpected character: ${char}`,
            cursorPosition,
            cursorPosition
          )
        )
        cursorPosition++
        continue
      }
      switch (lastTokenType) {
        case TOKEN_TYPES.Identifier:
        case TOKEN_TYPES.NumericLiteral:
        case TOKEN_TYPES.StringLiteral:
        case TOKEN_TYPES.CloseParen:
        case TOKEN_TYPES.CloseSquareBracket:
          // Part of a binary operator
          // a - 1, 1 - 1, true - 1, "apple" - 1, (1) - 1, a[1] - 1
          // Continue parsing normally
          break

        default: {
          // Is part of a unary operator
          // (-1), [-1], (1 + -1), not -1, -apple
          ++cursorPosition // consume the unary operator

          // Check for numbers following the unary operator
          const num = consumeWhile(isInteger)
          tokens.push(
            createToken(
              `${char}${num}`,
              num.length > 0
                ? TOKEN_TYPES.NumericLiteral
                : TOKEN_TYPES.UnaryOperator
            )
          )
          continue
        }
      }
    }

    // Try to match one of the tokens in the mapping table
    for (const [seq, type] of ORDERED_MAPPING_TABLE) {
      // inside an object literal, don't treat "}}" as expression-end
      if (seq === "}}" && curlyBracketDepth > 0) {
        continue
      }
      const slice = source.slice(cursorPosition, cursorPosition + seq.length)
      if (slice === seq) {
        // possibly adjust the curly bracket depth
        if (type === TOKEN_TYPES.OpenExpression) {
          curlyBracketDepth = 0
        } else if (type === TOKEN_TYPES.OpenCurlyBracket) {
          ++curlyBracketDepth
        } else if (type === TOKEN_TYPES.CloseCurlyBracket) {
          --curlyBracketDepth
        }
        cursorPosition += seq.length
        tokens.push(createToken(seq, type))

        // Handle whitespace control
        if (
          type === TOKEN_TYPES.CloseStatement &&
          options.trim_blocks &&
          source[cursorPosition] === "\n"
        ) {
          ++cursorPosition
        }
        continue main
      }
    }

    if (char === "'" || char === '"') {
      ++cursorPosition // Skip the opening quote
      const str = consumeWhile((c) => c !== char, "unterminated string literal")
      ++cursorPosition // Skip the closing quote
      tokens.push(createToken(str, TOKEN_TYPES.StringLiteral))
      continue
    }

    if (isInteger(char)) {
      // Consume integer part
      let num = consumeWhile(isInteger)
      // Possibly, consume fractional part
      if (
        source[cursorPosition] === "." &&
        isInteger(source[cursorPosition + 1])
      ) {
        ++cursorPosition // consume '.'
        const frac = consumeWhile(isInteger)
        num = `${num}.${frac}`
      }
      tokens.push(createToken(num, TOKEN_TYPES.NumericLiteral))
      continue
    }
    if (isWord(char)) {
      // consume any word characters and always classify as Identifier
      const word = consumeWhile(isWord)
      tokens.push(createToken(word, TOKEN_TYPES.Identifier))
      continue
    }

    errors.push(
      new LexerError(
        `Unexpected character: ${char}`,
        cursorPosition,
        cursorPosition
      )
    )
    cursorPosition++
  }

  if (!safe) {
    if (errors.length !== 0) {
      throw new SyntaxError("Lexing failed")
    }
    return tokens
  }

  return [tokens, errors]
}
