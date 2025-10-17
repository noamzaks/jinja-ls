import { TypeInfo, TypeReference } from "./types"

export const SPECIAL_SYMBOLS: Record<
  string,
  Record<string, string | TypeReference | TypeInfo | undefined>
> = {
  // These are the globals.
  Program: {
    true: "bool",
    false: "bool",
    none: "None",
    True: "bool",
    False: "bool",
    None: "None",
    range: {
      name: "class",
      signature: {
        arguments: [
          {
            name: "start",
            type: "int",
          },
          {
            name: "stop",
            type: "int",
          },
          {
            name: "step",
            type: "int",
          },
        ],
        return: {
          name: "range",
          elementType: "int",
        },
      },
    },
    dict: {
      name: "class",
      signature: {
        documentation:
          "A convenient alternative to dict literals. {'foo': 'bar'} is the same as dict(foo='bar').",
        return: "dict",
      },
    },
    lipsum: {
      name: "function",
      signature: {
        documentation: "Generate some lorem ipsum for the template.",
        arguments: [
          {
            name: "html",
            type: "bool",
            default: "True",
          },
          {
            name: "min",
            type: "int",
            default: "20",
          },
          {
            name: "max",
            type: "int",
            default: "100",
          },
        ],
        return: "str",
      },
    },
    cycler: {
      name: "class",
      signature: {
        documentation:
          "Cycle through values by yield them one at a time, then restarting once the end is reached.",
      },
    },
    joiner: {
      name: "class",
      signature: {
        arguments: [
          {
            name: "sep",
            type: "str",
            default: '", "',
          },
        ],
        documentation:
          'A tiny helper that can be used to "join" multiple sections. A joiner is passed a string and will return that string every time it\'s called, except the first time (in which case it returns an empty string).',
        return: "joiner",
      },
    },
    namespace: {
      name: "class",
      signature: {
        documentation:
          "A namespace object that can hold arbitrary attributes.  It may be initialized from a dictionary or with keyword arguments.",
        return: "namespace",
      },
    },
  },
  Macro: {
    varargs: {
      name: "tuple",
      documentation:
        "If more positional arguments are passed to the macro than accepted by the macro, they end up in the special varargs variable as a list of values.",
    },
    kwargs: {
      name: "dict",
      documentation:
        "Like varargs but for keyword arguments. All unconsumed keyword arguments are stored in this special variable.",
    },
    caller: {
      name: "function",
      signature: {
        return: "str",
        documentation:
          "If the macro was called from a call tag, the caller is stored in this variable as a callable macro.",
      },
    },
  },
  For: {
    loop: {
      name: "loop",
      properties: {
        index: {
          type: "int",
          documentation: "The current iteration of the loop. (1 indexed)",
        },
        index0: {
          type: "int",
          documentation: "The current iteration of the loop. (0 indexed)",
        },
        revindex: {
          type: "int",
          documentation:
            "The number of iterations from the end of the loop (1 indexed)",
        },
        revindex0: {
          type: "int",
          documentation:
            "The number of iterations from the end of the loop (0 indexed)",
        },
        first: { type: "bool", documentation: "True if first iteration." },
        last: { type: "bool", documentation: "True if last iteration." },
        length: {
          type: "int",
          documentation: "The number of items in the sequence.",
        },
        depth: {
          type: "int",
          documentation:
            "Indicates how deep in a recursive loop the rendering currently is. Starts at level 1",
        },
        depth0: {
          type: "int",
          documentation:
            "Indicates how deep in a recursive loop the rendering currently is. Starts at level 0",
        },
        previtem: {
          type: "unknown",
          documentation:
            "The item from the previous iteration of the loop. Undefined during the first iteration.",
        },
        nextitem: {
          type: "unknown",
          documentation:
            "The item from the following iteration of the loop. Undefined during the last iteration.",
        },
        cycle: {
          name: "function",
          signature: {
            documentation:
              "A helper function to cycle between a list of sequences.",
          },
        },
        changed: {
          name: "function",
          signature: {
            return: "bool",
            documentation:
              "True if previously called with a different value (or not called at all).",
          },
        },
      },
    },
  },
  Block: {
    super: {
      name: "super",
      signature: {
        return: "str",
        documentation: "The results of the parent block.",
      },
    },
  },
}

export const BUILTIN_FILTERS: Record<string, TypeInfo> = {
  abs: {
    name: "abs",
    signature: {
      documentation: "Return the absolute value of the argument.",
      arguments: [],
    },
  },
  attr: {
    name: "attr",
    signature: {
      documentation:
        'Get an attribute of an object. ``foo|attr("bar")`` works like ``foo.bar``, but returns undefined instead of falling back to ``foo["bar"]`` if the attribute doesn\'t exist.',
      arguments: [{ name: "name", type: "str" }],
    },
  },
  batch: {
    name: "batch",
    signature: {
      documentation:
        " A filter that batches items. It works pretty much like `slice` just the other way round. It returns a list of lists with the given number of items. If you provide a second parameter this is used to fill up missing items. See this example:",
      arguments: [
        { name: "linecount", type: "int" },
        { name: "fill_with", default: "None" },
      ],
    },
  },
  capitalize: {
    name: "capitalize",
    signature: {
      documentation:
        "Capitalize a value. The first character will be uppercase, all others lowercase. ",
      arguments: [],
      return: "str",
    },
  },
  center: {
    name: "center",
    signature: {
      documentation: "Centers the value in a field of a given width.",
      arguments: [{ name: "width", type: "int", default: "80" }],
      return: "str",
    },
  },
  count: {
    name: "count",
    signature: {
      documentation: "Return the number of items in a container.",
      arguments: [],
      return: "int",
    },
  },
  d: {
    name: "d",
    signature: {
      documentation:
        "If the value is undefined it will return the passed default value, otherwise the value of the variable:",
      arguments: [
        { name: "default_value", default: "" },
        { name: "boolean", type: "bool", default: "False" },
      ],
    },
  },
  default: {
    name: "default",
    signature: {
      documentation:
        "If the value is undefined it will return the passed default value, otherwise the value of the variable:",
      arguments: [
        { name: "default_value", default: "" },
        { name: "boolean", type: "bool", default: "False" },
      ],
    },
  },
  dictsort: {
    name: "dictsort",
    signature: {
      documentation:
        "Sort a dict and yield (key, value) pairs. Python dicts may not be in the order you want to display them in, so sort them first.",
      arguments: [
        { name: "case_sensitive", type: "bool", default: "False" },
        { name: "by", type: "str", default: '"key"' },
        { name: "reverse", type: "bool", default: "False" },
      ],
    },
  },
  e: {
    name: "e",
    signature: {
      documentation:
        "Replace the characters ``&``, ``<``, ``>``, ``'``, and ``\"`` in the string with HTML-safe sequences. Use this if you need to display text that might contain such characters in HTML.",
      arguments: [],
    },
  },
  escape: {
    name: "escape",
    signature: {
      documentation:
        "Replace the characters ``&``, ``<``, ``>``, ``'``, and ``\"`` in the string with HTML-safe sequences. Use this if you need to display text that might contain such characters in HTML.",
      arguments: [],
    },
  },
  filesizeformat: {
    name: "filesizeformat",
    signature: {
      documentation:
        "Format the value like a 'human-readable' file size (i.e. 13 kB, 4.1 MB, 102 Bytes, etc).  Per default decimal prefixes are used (Mega, Giga, etc.), if the second parameter is set to `True` the binary prefixes are used (Mebi, Gibi). ",
      arguments: [{ name: "binary", type: "bool", default: "False" }],
      return: "str",
    },
  },
  first: {
    name: "first",
    signature: {
      documentation: "Return the first item of a sequence.",
      arguments: [],
    },
  },
  float: {
    name: "float",
    signature: {
      documentation:
        "Convert the value into a floating point number. If the conversion doesn't work it will return ``0.0``. You can override this default using the first parameter. ",
      arguments: [{ name: "default", default: "0.0" }],
      return: "float",
    },
  },
  forceescape: {
    name: "forceescape",
    signature: {
      documentation:
        "Enforce HTML escaping.  This will probably double escape variables.",
      arguments: [],
    },
  },
  format: {
    name: "format",
    signature: {
      documentation:
        "Apply the given values to a `printf-style`_ format string, like ``string % values``.",
      args: "args",
      kwargs: "kwargs",
      return: "str",
    },
  },
  groupby: {
    name: "groupby",
    signature: {
      documentation:
        "Group a sequence of objects by an attribute using Python's :func:`itertools.groupby`. The attribute can use dot notation for nested access, like ``\"address.city\"``. Unlike Python's ``groupby``, the values are sorted first so only one group is returned for each unique value.",
      arguments: [
        { name: "attribute" },
        { name: "default", default: "None" },
        { name: "case_sensitive", type: "bool", default: "False" },
      ],
    },
  },
  indent: {
    name: "indent",
    signature: {
      documentation:
        "Return a copy of the string with each line indented by 4 spaces. The first line and blank lines are not indented by default.",
      arguments: [
        { name: "width", default: "4" },
        { name: "first", type: "bool", default: "False" },
        { name: "blank", type: "bool", default: "False" },
      ],
      return: "str",
    },
  },
  int: {
    name: "int",
    signature: {
      documentation:
        "Convert the value into an integer. If the conversion doesn't work it will return ``0``. You can override this default using the first parameter. You can also override the default base (10) in the second parameter, which handles input with prefixes such as 0b, 0o and 0x for bases 2, 8 and 16 respectively. The base is ignored for decimal numbers and non-string values. ",
      arguments: [
        { name: "default", default: "0" },
        { name: "base", default: "10" },
      ],
      return: "int",
    },
  },
  join: {
    name: "join",
    signature: {
      documentation:
        "Return a string which is the concatenation of the strings in the sequence. The separator between elements is an empty string per default, you can define it with the optional parameter:",
      arguments: [
        { name: "d", type: "str", default: "" },
        { name: "attribute", default: "None" },
      ],
      return: "str",
    },
  },
  last: {
    name: "last",
    signature: {
      documentation: "Return the last item of a sequence.",
      arguments: [],
    },
  },
  length: {
    name: "length",
    signature: {
      documentation: "Return the number of items in a container.",
      arguments: [],
      return: "int",
    },
  },
  list: {
    name: "list",
    signature: {
      documentation:
        "Convert the value into a list.  If it was a string the returned list will be a list of characters. ",
      arguments: [],
    },
  },
  lower: {
    name: "lower",
    signature: {
      documentation: "Convert a value to lowercase.",
      arguments: [],
      return: "str",
    },
  },
  items: {
    name: "items",
    signature: {
      documentation:
        "Return an iterator over the ``(key, value)`` items of a mapping.",
      arguments: [],
    },
  },
  map: {
    name: "map",
    signature: {
      documentation:
        "Applies a filter on a sequence of objects or looks up an attribute. This is useful when dealing with lists of objects but you are really only interested in a certain value of it.",
      arguments: [],
      args: "args",
      kwargs: "kwargs",
    },
  },
  min: {
    name: "min",
    signature: {
      documentation: "Return the smallest item from the sequence.",
      arguments: [
        { name: "case_sensitive", type: "bool", default: "False" },
        { name: "attribute", default: "None" },
      ],
    },
  },
  max: {
    name: "max",
    signature: {
      documentation: "Return the largest item from the sequence.",
      arguments: [
        { name: "case_sensitive", type: "bool", default: "False" },
        { name: "attribute", default: "None" },
      ],
    },
  },
  pprint: {
    name: "pprint",
    signature: {
      documentation: "Pretty print a variable. Useful for debugging.",
      arguments: [],
      return: "str",
    },
  },
  random: {
    name: "random",
    signature: {
      documentation: "Return a random item from the sequence.",
      arguments: [],
    },
  },
  reject: {
    name: "reject",
    signature: {
      documentation:
        "Filters a sequence of objects by applying a test to each object, and rejecting the objects with the test succeeding.",
      args: "args",
      kwargs: "kwargs",
    },
  },
  rejectattr: {
    name: "rejectattr",
    signature: {
      documentation:
        "Filters a sequence of objects by applying a test to the specified attribute of each object, and rejecting the objects with the test succeeding.",
      arguments: [],
      args: "args",
      kwargs: "kwargs",
    },
  },
  replace: {
    name: "replace",
    signature: {
      documentation:
        "Return a copy of the value with all occurrences of a substring replaced with a new one. The first argument is the substring that should be replaced, the second is the replacement string. If the optional third argument ``count`` is given, only the first ``count`` occurrences are replaced:",
      arguments: [
        { name: "old", type: "str", default: "None" },
        { name: "new", type: "str", default: "None" },
        { name: "count", default: "None" },
      ],
    },
  },
  reverse: {
    name: "reverse",
    signature: {
      documentation:
        "Reverse the object or return an iterator that iterates over it the other way round. ",
      arguments: [],
    },
  },
  round: {
    name: "round",
    signature: {
      documentation:
        "Round the number to a given precision. The first parameter specifies the precision (default is ``0``), the second the rounding method:",
      arguments: [
        { name: "precision", type: "int", default: "0" },
        { name: "method", type: "str", default: "common" },
      ],
      return: "float",
    },
  },
  safe: {
    name: "safe",
    signature: {
      documentation:
        "Mark the value as safe which means that in an environment with automatic escaping enabled this variable will not be escaped. ",
      arguments: [],
    },
  },
  select: {
    name: "select",
    signature: {
      documentation:
        "Filters a sequence of objects by applying a test to each object, and only selecting the objects with the test succeeding.",
      args: "args",
      kwargs: "kwargs",
    },
  },
  selectattr: {
    name: "selectattr",
    signature: {
      documentation:
        "Filters a sequence of objects by applying a test to the specified attribute of each object, and only selecting the objects with the test succeeding.",
      args: "args",
      kwargs: "kwargs",
    },
  },
  slice: {
    name: "slice",
    signature: {
      documentation:
        "Slice an iterator and return a list of lists containing those items. Useful if you want to create a div containing three ul tags that represent columns:",
      arguments: [
        { name: "slices", type: "int" },
        { name: "fill_with", default: "None" },
      ],
    },
  },
  sort: {
    name: "sort",
    signature: {
      documentation: "Sort an iterable using Python's :func:`sorted`.",
      arguments: [
        { name: "reverse", type: "bool", default: "False" },
        { name: "case_sensitive", type: "bool", default: "False" },
        { name: "attribute", default: "None" },
      ],
    },
  },
  string: {
    name: "string",
    signature: {
      documentation:
        "Convert an object to a string if it isn't already. This preserves a :class:`Markup` string rather than converting it back to a basic string, so it will still be marked as safe and won't be escaped again.",
      arguments: [],
      return: "str",
    },
  },
  striptags: {
    name: "striptags",
    signature: {
      documentation:
        "Strip SGML/XML tags and replace adjacent whitespace by one space.",
      arguments: [],
      return: "str",
    },
  },
  sum: {
    name: "sum",
    signature: {
      documentation:
        "Returns the sum of a sequence of numbers plus the value of parameter 'start' (which defaults to 0).  When the sequence is empty it returns start.",
      arguments: [
        { name: "attribute", default: "None" },
        { name: "start", default: "0" },
      ],
    },
  },
  title: {
    name: "title",
    signature: {
      documentation:
        "Return a titlecased version of the value. I.e. words will start with uppercase letters, all remaining characters are lowercase. ",
      arguments: [],
      return: "str",
    },
  },
  trim: {
    name: "trim",
    signature: {
      documentation:
        "Strip leading and trailing characters, by default whitespace.",
      arguments: [{ name: "chars", default: "None" }],
      return: "str",
    },
  },
  truncate: {
    name: "truncate",
    signature: {
      documentation:
        'Return a truncated copy of the string. The length is specified with the first parameter which defaults to ``255``. If the second parameter is ``true`` the filter will cut the text at length. Otherwise it will discard the last word. If the text was in fact truncated it will append an ellipsis sign (``"..."``). If you want a different ellipsis sign than ``"..."`` you can specify it using the third parameter. Strings that only exceed the length by the tolerance margin given in the fourth parameter will not be truncated.',
      arguments: [
        { name: "length", type: "int", default: "255" },
        { name: "killwords", type: "bool", default: "False" },
        { name: "end", type: "str", default: "..." },
        { name: "leeway", default: "None" },
      ],
      return: "str",
    },
  },
  unique: {
    name: "unique",
    signature: {
      documentation: "Returns a list of unique items from the given iterable.",
      arguments: [
        { name: "case_sensitive", default: "False" },
        { name: "attribute", default: "None" },
      ],
    },
  },
  upper: {
    name: "upper",
    signature: {
      documentation: "Convert a value to uppercase.",
      arguments: [],
      return: "str",
    },
  },
  urlencode: {
    name: "urlencode",
    signature: {
      documentation: "Quote data for use in a URL path or query using UTF-8.",
      arguments: [],
      return: "str",
    },
  },
  urlize: {
    name: "urlize",
    signature: {
      documentation: "Convert URLs in text into clickable links.",
      arguments: [
        { name: "trim_url_limit", default: "None" },
        { name: "nofollow", type: "bool", default: "False" },
        { name: "target", default: "None" },
        { name: "rel", default: "None" },
        { name: "extra_schemes", default: "None" },
      ],
      return: "str",
    },
  },
  wordcount: {
    name: "wordcount",
    signature: {
      documentation: "Count the words in that string.",
      arguments: [],
      return: "int",
    },
  },
  wordwrap: {
    name: "wordwrap",
    signature: {
      documentation:
        "Wrap a string to the given width. Existing newlines are treated as paragraphs to be wrapped separately.",
      arguments: [
        { name: "width", type: "int", default: "79" },
        { name: "break_long_words", type: "bool", default: "True" },
        { name: "wrapstring", default: "None" },
        { name: "break_on_hyphens", type: "bool", default: "True" },
      ],
      return: "str",
    },
  },
  xmlattr: {
    name: "xmlattr",
    signature: {
      documentation:
        "Create an SGML/XML attribute string based on the items in a dict.",
      arguments: [{ name: "autospace", type: "bool", default: "True" }],
    },
  },
  tojson: {
    name: "tojson",
    signature: {
      documentation:
        "Serialize an object to a string of JSON, and mark it safe to render in HTML. This filter is only for use in HTML documents.",
      arguments: [{ name: "indent", default: "None" }],
    },
  },
}

export const BUILTIN_TESTS: Record<string, TypeInfo> = {
  odd: {
    name: "odd",
    signature: {
      documentation: "Return true if the variable is odd.",
      arguments: [],
      return: "bool",
    },
  },
  even: {
    name: "even",
    signature: {
      documentation: "Return true if the variable is even.",
      arguments: [],
      return: "bool",
    },
  },
  divisibleby: {
    name: "divisibleby",
    signature: {
      documentation: "Check if a variable is divisible by a number.",
      arguments: [{ name: "num", type: "int" }],
      return: "bool",
    },
  },
  defined: {
    name: "defined",
    signature: {
      documentation: "Return true if the variable is defined:",
      arguments: [],
      return: "bool",
    },
  },
  undefined: {
    name: "undefined",
    signature: {
      documentation: "Like 'defined' but the other way round.",
      arguments: [],
      return: "bool",
    },
  },
  filter: {
    name: "filter",
    signature: {
      documentation:
        "Check if a filter exists by name. Useful if a filter may be optionally available.",
      arguments: [],
      return: "bool",
    },
  },
  test: {
    name: "test",
    signature: {
      documentation:
        "Check if a test exists by name. Useful if a test may be optionally available.",
      arguments: [],
      return: "bool",
    },
  },
  none: {
    name: "none",
    signature: {
      documentation: "Return true if the variable is none.",
      arguments: [],
      return: "bool",
    },
  },
  boolean: {
    name: "boolean",
    signature: {
      documentation: "Return true if the object is a boolean value.",
      arguments: [],
      return: "bool",
    },
  },
  false: {
    name: "false",
    signature: {
      documentation: "Return true if the object is False.",
      arguments: [],
      return: "bool",
    },
  },
  true: {
    name: "true",
    signature: {
      documentation: "Return true if the object is True.",
      arguments: [],
      return: "bool",
    },
  },
  integer: {
    name: "integer",
    signature: {
      documentation: "Return true if the object is an integer.",
      arguments: [],
      return: "bool",
    },
  },
  float: {
    name: "float",
    signature: {
      documentation: "Return true if the object is a float.",
      arguments: [],
      return: "bool",
    },
  },
  lower: {
    name: "lower",
    signature: {
      documentation: "Return true if the variable is lowercased.",
      arguments: [],
      return: "bool",
    },
  },
  upper: {
    name: "upper",
    signature: {
      documentation: "Return true if the variable is uppercased.",
      arguments: [],
      return: "bool",
    },
  },
  string: {
    name: "string",
    signature: {
      documentation: "Return true if the object is a string.",
      arguments: [],
      return: "bool",
    },
  },
  mapping: {
    name: "mapping",
    signature: {
      documentation: "Return true if the object is a mapping (dict etc.).",
      arguments: [],
      return: "bool",
    },
  },
  number: {
    name: "number",
    signature: {
      documentation: "Return true if the variable is a number.",
      arguments: [],
      return: "bool",
    },
  },
  sequence: {
    name: "sequence",
    signature: {
      documentation:
        "Return true if the variable is a sequence. Sequences are variables that are iterable. ",
      arguments: [],
      return: "bool",
    },
  },
  iterable: {
    name: "iterable",
    signature: {
      documentation: "Check if it's possible to iterate over an object.",
      arguments: [],
      return: "bool",
    },
  },
  callable: {
    name: "callable",
    signature: {
      documentation:
        "Return whether the object is callable (i.e., some kind of function).",
      arguments: [],
      return: "bool",
    },
  },
  sameas: {
    name: "sameas",
    signature: {
      documentation:
        "Check if an object points to the same memory address than another object:",
      arguments: [{ name: "other" }],
      return: "bool",
    },
  },
  escaped: {
    name: "escaped",
    signature: {
      documentation: "Check if the value is escaped.",
      arguments: [],
      return: "bool",
    },
  },
  in: {
    name: "in",
    signature: {
      documentation: "Check if value is in seq.",
      arguments: [{ name: "seq" }],
      return: "bool",
    },
  },
  "==": {
    name: "==",
    signature: {
      documentation: "Same as a == b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  eq: {
    name: "eq",
    signature: {
      documentation: "Same as a == b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  equalto: {
    name: "equalto",
    signature: {
      documentation: "Same as a == b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  "!=": {
    name: "!=",
    signature: {
      documentation: "Same as a != b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  ne: {
    name: "ne",
    signature: {
      documentation: "Same as a != b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  ">": {
    name: ">",
    signature: {
      documentation: "Same as a > b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  gt: {
    name: "gt",
    signature: {
      documentation: "Same as a > b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  greaterthan: {
    name: "greaterthan",
    signature: {
      documentation: "Same as a > b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  ge: {
    name: "ge",
    signature: {
      documentation: "Same as a >= b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  ">=": {
    name: ">=",
    signature: {
      documentation: "Same as a >= b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  "<": {
    name: "<",
    signature: {
      documentation: "Same as a < b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  lt: {
    name: "lt",
    signature: {
      documentation: "Same as a < b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  lessthan: {
    name: "lessthan",
    signature: {
      documentation: "Same as a < b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  "<=": {
    name: "<=",
    signature: {
      documentation: "Same as a <= b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
  le: {
    name: "le",
    signature: {
      documentation: "Same as a <= b.",
      arguments: [{ name: "b" }],
      return: "bool",
    },
  },
}

export const HOVER_LITERAL_MAX_LENGTH = 20
