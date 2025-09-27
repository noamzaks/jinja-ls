import { describe, expect, it } from "vitest"
import { tokenize } from "../src"

const LEXER_ERRORS = Object.freeze({
  UNCLOSED_STRING_LITERAL: {
    text: "{{ ' }}",
    tokens: [
      { type: "OpenExpression", value: "{{", start: 0, end: 2 },
      { type: "StringLiteral", value: " }}", start: 3, end: 7 },
    ],
    errors: [
      {
        start: 7,
        end: 7,
        message: "Unterminated string literal",
      },
    ],
  },
  MISSING_ESCAPED_CHARACTER: {
    text: '{{ "Hi\\',
    tokens: [
      {
        type: "OpenExpression",
        value: "{{",
        start: 0,
        end: 2,
      },
      {
        type: "StringLiteral",
        value: "Hi",
        start: 3,
        end: 7,
      },
    ],
    errors: [{ message: "Missing escaped character", start: 6, end: 7 }],
  },
  INVALID_ESCAPED_CHARACTER: {
    text: '{{ "h\\zi" }}',
    tokens: [
      {
        type: "OpenExpression",
        value: "{{",
        start: 0,
        end: 2,
      },
      {
        type: "StringLiteral",
        value: "hi",
        start: 3,
        end: 9,
      },
      {
        type: "CloseExpression",
        value: "}}",
        start: 10,
        end: 12,
      },
    ],
    errors: [{ message: "Invalid escaped character: z", start: 5, end: 7 }],
  },
  MISSING_END_OF_COMMENT: {
    text: "{{ HI }}{# {% #",
    tokens: [
      {
        type: "OpenExpression",
        value: "{{",
        start: 0,
        end: 2,
      },
      {
        type: "Identifier",
        value: "HI",
        start: 3,
        end: 5,
      },
      {
        type: "CloseExpression",
        value: "}}",
        start: 6,
        end: 8,
      },
      {
        type: "Comment",
        value: " {% #",
        start: 8,
        end: 15,
      },
    ],
    errors: [
      {
        message: "Missing end of comment tag",
        start: 15,
        end: 15,
      },
    ],
  },
  UNEXPECTED_CHARACTER: {
    text: "{{ HI }}{{ ! }}{{ HI }}",
    tokens: [
      {
        type: "OpenExpression",
        value: "{{",
        start: 0,
        end: 2,
      },
      {
        type: "Identifier",
        value: "HI",
        start: 3,
        end: 5,
      },
      {
        type: "CloseExpression",
        value: "}}",
        start: 6,
        end: 8,
      },
      {
        type: "OpenExpression",
        value: "{{",
        start: 8,
        end: 10,
      },
      {
        type: "CloseExpression",
        value: "}}",
        start: 13,
        end: 15,
      },
      {
        type: "OpenExpression",
        value: "{{",
        start: 15,
        end: 17,
      },
      {
        type: "Identifier",
        value: "HI",
        start: 18,
        end: 20,
      },
      {
        type: "CloseExpression",
        value: "}}",
        start: 21,
        end: 23,
      },
    ],
    errors: [
      {
        message: "Unexpected character: !",
        start: 11,
        end: 11,
      },
    ],
  },
})

describe("Lexing error recovery", () => {
  for (const [name, test] of Object.entries(LEXER_ERRORS)) {
    it(`should return succesful tokens before ${name}`, () => {
      const [tokens, errors] = tokenize(test.text, {}, true)
      expect(errors).toEqual(test.errors)
      expect(tokens).toEqual(test.tokens)
    })
  }
})
