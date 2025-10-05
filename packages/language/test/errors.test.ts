import { describe, expect, it } from "vitest"
import { parse, tokenize } from "../src"

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

const PARSER_ERRORS = Object.freeze({
  MISSING_STATEMENT_NAME: {
    text: "{% %}",
    errors: [
      {
        before: {
          start: 3,
        },
        missingType: "statement name",
        type: "MissingNode",
      },
    ],
  },
  MISSING_EXPRESSION: {
    text: "{% if %}{% endif %}",
    errors: [
      {
        before: {
          start: 6,
        },
        type: "MissingNode",
        missingType: "expression",
      },
    ],
  },
  MISSING_ENDIF: {
    text: "{% if true %}wow",
    errors: [
      {
        before: {
          end: 16,
        },
        type: "MissingNode",
        missingType: "'{% endif %}'",
      },
    ],
  },
  MISSING_ENDMACRO: {
    text: "{% macro test() %}wow",
    errors: [
      {
        before: {
          end: 21,
        },
        type: "MissingNode",
        missingType: "'{% endmacro %}'",
      },
    ],
  },
  MISSING_ENDFOR: {
    text: "{% for x in [] %}wow",
    errors: [
      {
        before: {
          end: 20,
        },
        type: "MissingNode",
        missingType: "'{% endfor %}'",
      },
    ],
  },
  MISSING_ENDCALL: {
    text: "{% call test() %}wow",
    errors: [
      {
        before: {
          end: 20,
        },
        type: "MissingNode",
        missingType: "'{% endcall %}'",
      },
    ],
  },
  MISSING_ENDFILTER: {
    text: "{% filter upper %}wow",
    errors: [
      {
        before: {
          end: 21,
        },
        type: "MissingNode",
        missingType: "'{% endfilter %}'",
      },
    ],
  },
  MISSING_ENDRAW: {
    text: "{% raw %}wow",
    errors: [
      {
        before: {
          end: 12,
        },
        type: "MissingNode",
        missingType: "'{% endraw %}'",
      },
    ],
  },
  MISSING_MACRO_NAME: {
    text: "{% macro %}",
    errors: [
      {
        before: {
          start: 9,
        },
        type: "MissingNode",
        missingType: "macro name",
      },
    ],
  },
  MISSING_MACRO_NAME_2: {
    text: "{% macro [] %}",
    errors: [
      {
        before: {
          start: 9,
        },
        type: "MissingNode",
        missingType: "macro name",
      },
    ],
  },
  MISSING_CALL_IDENTIFIER: {
    text: "{% call %}",
    errors: [
      {
        before: {
          start: 8,
        },
        type: "MissingNode",
        missingType: "identifier for callee",
      },
    ],
  },
  MISSING_CALL_IDENTIFIER_2: {
    text: "{% call 1574 %}",
    errors: [
      {
        before: {
          start: 8,
        },
        type: "MissingNode",
        missingType: "identifier for callee",
      },
    ],
  },
  MISSING_FROM_IMPORT_IDENTIFIER: {
    text: '{% from "test.j2" import %}',
    errors: [
      {
        before: {
          start: 25,
        },
        type: "MissingNode",
        missingType: "identifier to import",
      },
    ],
  },
  MISSING_FROM_IMPORT_IDENTIFIER_2: {
    text: '{% from "test.j2" import "" %}',
    errors: [
      {
        before: {
          start: 25,
        },
        type: "MissingNode",
        missingType: "identifier to import",
      },
    ],
  },
  MISSING_FROM_IMPORT_IDENTIFIER_3: {
    text: '{% from "test.j2" import a as b, "" as c %}',
    errors: [
      {
        before: {
          start: 33,
        },
        type: "MissingNode",
        missingType: "identifier to import",
      },
    ],
  },
  MISSING_FROM_IMPORT_NAME_IDENTIFIER: {
    text: '{% from "test.j2" import a as %}',
    errors: [
      {
        before: {
          start: 30,
        },
        type: "MissingNode",
        missingType: "identifier for imported name",
      },
    ],
  },
  MISSING_FROM_IMPORT_NAME_IDENTIFIER_2: {
    text: '{% from "test.j2" import a as [] %}',
    errors: [
      {
        before: {
          start: 30,
        },
        type: "MissingNode",
        missingType: "identifier for imported name",
      },
    ],
  },
  UNEXPECTED_ENDBLOCK_IDENTIFIER: {
    text: "{% block hi %}{% endblock hello %}",
    errors: [
      {
        token: {
          start: 26,
          end: 31,
        },
        type: "UnexpectedToken",
        message: "Expected 'hi', got 'hello' instead",
      },
    ],
  },
  MISSING_FOR_LOOPVAR: {
    text: "{% for in [] %}",
    errors: [
      {
        before: {
          start: 7,
        },
        type: "MissingNode",
        missingType: "identifier/tuple for the loop variable",
      },
    ],
  },
  MISSING_FOR_LOOPVAR_2: {
    text: '{% for "" in [] %}',
    errors: [
      {
        before: {
          start: 7,
        },
        type: "MissingNode",
        missingType: "identifier/tuple for the loop variable",
      },
    ],
  },
  MISSING_FOR_IN: {
    text: "{% for x [] %}{% endfor %}",
    errors: [
      {
        before: {
          start: 9,
        },
        type: "MissingNode",
        missingType: "'in' keyword following loop variable",
      },
    ],
  },
  MISSING_KWARG_IDENTIFIER: {
    text: '{{ f("x"=2) }}',
    errors: [
      {
        before: {
          start: 5,
        },
        type: "MissingNode",
        missingType: "identifier for keyword argument",
      },
    ],
  },
  MISSING_SLICES: {
    text: "{{ x[] }}",
    errors: [
      {
        before: {
          start: 5,
        },
        type: "MissingNode",
        missingType: "at least one argument for member/slice expression",
      },
    ],
  },
  TOO_MANY_SLICES: {
    text: "{{ x[1:1:1:1] }}",
    errors: [
      {
        before: {
          start: 12,
        },
        type: "MissingNode",
        missingType: "at most three argument for slice expression",
      },
    ],
  },
  MISSING_PROPERTY_IDENTIFIER: {
    text: "{{ x. }}",
    errors: [
      {
        before: {
          start: 6,
        },
        type: "MissingNode",
        missingType: "identifier for member expression",
      },
    ],
  },
  MISSING_PROPERTY_IDENTIFIER_2: {
    text: "{{ x.[] }}",
    errors: [
      {
        before: {
          start: 5,
        },
        type: "MissingNode",
        missingType: "identifier for member expression",
      },
    ],
  },
  MISSING_TEST_IDENTIFIER: {
    text: "{{ x is }}",
    errors: [
      {
        before: {
          start: 8,
        },
        type: "MissingNode",
        missingType: "identifier for the test",
      },
    ],
  },
  MISSING_TEST_IDENTIFIER_2: {
    text: "{{ x is [] }}",
    errors: [
      {
        before: {
          start: 8,
        },
        type: "MissingNode",
        missingType: "identifier for the test",
      },
    ],
  },
  MISSING_FILTER_IDENTIFIER: {
    text: "{{ x | }}",
    errors: [
      {
        before: {
          start: 7,
        },
        type: "MissingNode",
        missingType: "identifier for the filter",
      },
    ],
  },
  MISSING_FILTER_IDENTIFIER_2: {
    text: "{{ x | [] }}",
    errors: [
      {
        before: {
          start: 7,
        },
        type: "MissingNode",
        missingType: "identifier for the filter",
      },
    ],
  },
})

describe("Lexing error recovery", () => {
  for (const [name, test] of Object.entries(LEXER_ERRORS)) {
    it(`should recover and report lexer errors ${name}`, () => {
      const [tokens, errors] = tokenize(test.text, {}, true)
      expect(errors).toEqual(test.errors)
      expect(tokens).toEqual(test.tokens)
      // Make sure parser doesn't throw error or enter infinite loop.
      parse(tokens, true)
    })
  }
})

describe("Parsing error recovery", () => {
  for (const [name, test] of Object.entries(PARSER_ERRORS)) {
    it(`should recover and report parser errors ${name}`, () => {
      const [tokens] = tokenize(test.text, {}, true)
      const parsed = parse(tokens, true)
      const errors = parsed[2]
      expect(errors).toMatchObject(test.errors)
    })
  }
})
