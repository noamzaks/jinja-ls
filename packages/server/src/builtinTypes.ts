import { type TypeInfo } from "./types"

export const BUILTIN_TYPES: Record<string, TypeInfo> = {
  str: {
    name: "str",
    properties: {
      capitalize: {
        name: "capitalize",
        signature: {
          documentation: "Return a capitalized version of the string.",
          return: "str",
        },
      },
      casefold: {
        name: "casefold",
        signature: {
          documentation:
            "Return a version of the string suitable for caseless comparisons.",
          return: "str",
        },
      },
      center: {
        name: "center",
        signature: {
          documentation: "Return a centered string of length width.",
          arguments: [
            { name: "width", type: "int" },
            { name: "fillchar", type: "str", default: '" "' },
          ],
          return: "str",
        },
      },
      encode: {
        name: "encode",
        signature: {
          documentation:
            "Encode the string using the codec registered for encoding.",
          arguments: [
            { name: "encoding", type: "str", default: '"utf-8"' },
            { name: "errors", type: "str", default: '"strict"' },
          ],
          return: { name: "bytes" },
        },
      },
      expandtabs: {
        name: "expandtabs",
        signature: {
          documentation:
            "Return a copy where all tab characters are expanded using spaces.",
          arguments: [{ name: "tabwidth", type: "int", default: "8" }],
          return: "str",
        },
      },
      format: {
        name: "format",
        signature: {
          documentation:
            "Return a formatted version of the string, using substitutions from args and kwargs.\nThe substitutions are identified by braces ('{' and '}').",
          args: "args",
          kwargs: "kwargs",
          return: "str",
        },
      },
      format_map: {
        name: "format_map",
        signature: {
          documentation:
            "Return a formatted version of the string, using substitutions from mapping.\nThe substitutions are identified by braces ('{' and '}').",
          arguments: [{ name: "mapping", type: "dict" }],
          return: "str",
        },
      },
      isalnum: {
        name: "isalnum",
        signature: {
          documentation:
            "Return True if the string is an alpha-numeric string, False otherwise.",
          return: "bool",
        },
      },
      isalpha: {
        name: "isalpha",
        signature: {
          documentation:
            "Return True if the string is an alphabetic string, False otherwise.",
          return: "bool",
        },
      },
      isascii: {
        name: "isascii",
        signature: {
          documentation:
            "Return True if all characters in the string are ASCII, False otherwise.",
          return: "bool",
        },
      },
      isdecimal: {
        name: "isdecimal",
        signature: {
          documentation:
            "Return True if the string is a decimal string, False otherwise.",
          return: "bool",
        },
      },
      isdigit: {
        name: "isdigit",
        signature: {
          documentation:
            "Return True if the string is a digit string, False otherwise.",
          return: "bool",
        },
      },
      isidentifier: {
        name: "isidentifier",
        signature: {
          documentation:
            "Return True if the string is a valid Python identifier, False otherwise.",
          return: "bool",
        },
      },
      islower: {
        name: "islower",
        signature: {
          documentation:
            "Return True if the string is a lowercase string, False otherwise.",
          return: "bool",
        },
      },
      isnumeric: {
        name: "isnumeric",
        signature: {
          documentation:
            "Return True if the string is a numeric string, False otherwise.",
          return: "bool",
        },
      },
      isprintable: {
        name: "isprintable",
        signature: {
          documentation:
            "Return True if all characters in the string are printable, False otherwise.",
          return: "bool",
        },
      },
      isspace: {
        name: "isspace",
        signature: {
          documentation:
            "Return True if the string is a whitespace string, False otherwise.",
          return: "bool",
        },
      },
      istitle: {
        name: "istitle",
        signature: {
          documentation:
            "Return True if the string is a title-cased string, False otherwise.",
          return: "bool",
        },
      },
      isupper: {
        name: "isupper",
        signature: {
          documentation:
            "Return True if the string is an uppercase string, False otherwise.",
          return: "bool",
        },
      },
      join: {
        name: "join",
        signature: {
          documentation: "Concatenate any number of strings.",
          arguments: [{ name: "iterable" }],
          return: "str",
        },
      },
      ljust: {
        name: "ljust",
        signature: {
          documentation: "Return a left-justified string of length width.",
          arguments: [
            { name: "width", type: "int" },
            { name: "fillchar", type: "str", default: '" "' },
          ],
          return: "str",
        },
      },
      lower: {
        name: "lower",
        signature: {
          documentation: "Return a copy of the string converted to lowercase.",
          return: "str",
        },
      },
      lstrip: {
        name: "lstrip",
        signature: {
          documentation:
            "Return a copy of the string with leading whitespace removed.",
          arguments: [{ name: "chars", default: "None" }],
          return: "str",
        },
      },
      partition: {
        name: "partition",
        signature: {
          documentation:
            "Partition the string into three parts using the given separator.",
          arguments: [{ name: "sep", type: "str" }],
          // TODO: this is known to be tuple[str, str, str]
          return: "tuple",
        },
      },
      removeprefix: {
        name: "removeprefix",
        signature: {
          documentation:
            "Return a str with the given prefix string removed if present.",
          arguments: [{ name: "prefix", type: "str" }],
          return: "str",
        },
      },
      removesuffix: {
        name: "removesuffix",
        signature: {
          documentation:
            "Return a str with the given suffix string removed if present.",
          arguments: [{ name: "suffix", type: "str" }],
          return: "str",
        },
      },
      replace: {
        name: "replace",
        signature: {
          documentation:
            "Return a copy with all occurrences of substring old replaced by new.",
          arguments: [
            { name: "old", type: "str" },
            { name: "new", type: "str" },
            { name: "count", type: "int", default: "-1" },
          ],
          return: "str",
        },
      },
      rjust: {
        name: "rjust",
        signature: {
          documentation: "Return a right-justified string of length width.",
          arguments: [
            { name: "width", type: "int" },
            { name: "fillchar", type: "str", default: '" "' },
          ],
          return: "str",
        },
      },
      rpartition: {
        name: "rpartition",
        signature: {
          documentation:
            "Partition the string into three parts using the given separator.",
          arguments: [{ name: "sep", type: "str" }],
          // TODO: this is known to be tuple[str, str, str]
          return: "tuple",
        },
      },
      rsplit: {
        name: "rsplit",
        signature: {
          documentation:
            "Return a list of the substrings in the string, using sep as the separator string.",
          arguments: [
            { name: "sep", type: "str" },
            { name: "maxsplit", type: "int", default: "-1" },
          ],
          // TODO: this is known to be list[str]
          return: "list",
        },
      },
      rstrip: {
        name: "rstrip",
        signature: {
          documentation:
            "Return a copy of the string with trailing whitespace removed.",
          arguments: [{ name: "chars", default: "None" }],
          return: "str",
        },
      },
      split: {
        name: "split",
        signature: {
          documentation:
            "Return a list of the substrings in the string, using sep as the separator string.",
          arguments: [
            { name: "sep", type: "str" },
            { name: "maxsplit", type: "int", default: "-1" },
          ],
          // TODO: this is known to be list[str]
          return: "list",
        },
      },
      splitlines: {
        name: "splitlines",
        signature: {
          documentation:
            "Return a list of the lines in the string, breaking at line boundaries.",
          arguments: [{ name: "keepends", type: "bool", default: "False" }],
          // TODO: this is known to be list[str]
          return: "list",
        },
      },
      strip: {
        name: "strip",
        signature: {
          documentation:
            "Return a copy of the string with leading and trailing whitespace removed.",
          arguments: [{ name: "chars", default: "None" }],
          return: "str",
        },
      },
      swapcase: {
        name: "swapcase",
        signature: {
          documentation:
            "Convert uppercase characters to lowercase and lowercase characters to uppercase.",
          return: "str",
        },
      },
      title: {
        name: "title",
        signature: {
          documentation:
            "Return a version of the string where each word is titlecased.",
          return: "str",
        },
      },
      translate: {
        name: "translate",
        signature: {
          documentation:
            "Replace each character in the string using the given translation table.",
          arguments: [{ name: "table", type: "dict" }],
          return: "str",
        },
      },
      upper: {
        name: "upper",
        signature: {
          documentation: "Return a copy of the string converted to uppercase.",
          return: "str",
        },
      },
      zfill: {
        name: "zfill",
        signature: {
          documentation:
            "Pad a numeric string with zeros on the left, to fill a field of the given width.",
          arguments: [{ name: "width", type: "int" }],
          return: "str",
        },
      },
    },
    elementType: "str",
  },
  int: {
    name: "int",
    properties: {
      as_integer_ratio: {
        name: "as_integer_ratio",
        signature: {
          documentation:
            "Return a pair of integers, whose ratio is equal to the original int.",
          // TODO: known to be tuple[int, int]
          return: "tuple",
        },
      },
      bit_count: {
        name: "bit_count",
        signature: {
          documentation:
            "Number of ones in the binary representation of the absolute value of self.",
          return: "int",
        },
      },
      bit_length: {
        name: "bit_length",
        signature: {
          documentation:
            "Number of bits necessary to represent self in binary.",
          return: "int",
        },
      },
      conjugate: {
        name: "conjugate",
        signature: {
          documentation: "Returns self, the complex conjugate of any int.",
          return: "int",
        },
      },
      denominator: "int",
      from_bytes: {
        name: "from_bytes",
        signature: {
          documentation:
            "Return the integer represented by the given array of bytes.",
          arguments: [
            { name: "bytes" },
            { name: "byteorder", type: "str", default: '"big"' },
            { name: "signed", type: "bool", default: "False" },
          ],
          return: "int",
        },
      },
      imag: "int",
      is_integer: {
        name: "is_integer",
        signature: {
          documentation:
            "Returns True. Exists for duck type compatibility with float.is_integer.",
          return: "bool",
        },
      },
      numerator: "int",
      real: "int",
      to_bytes: {
        name: "to_bytes",
        signature: {
          documentation: "Return an array of bytes representing an integer.",
          return: { name: "bytes" },
        },
      },
    },
  },
  float: {
    name: "float",
    properties: {
      as_integer_ratio: {
        name: "as_integer_ratio",
        signature: {
          documentation:
            "Return a pair of integers, whose ratio is exactly equal to the original float.",
          // TODO: this is known to be tuple[int, int]
          return: "tuple",
        },
      },
      conjugate: {
        name: "conjugate",
        signature: {
          documentation: "Return self, the complex conjugate of any float.",
          return: "float",
        },
      },
      fromhex: {
        name: "fromhex",
        signature: {
          documentation:
            "Create a floating-point number from a hexadecimal string.",
          arguments: [{ name: "string", type: "str" }],
          return: "float",
        },
      },
      hex: {
        name: "hex",
        signature: {
          documentation:
            "Return a hexadecimal representation of a floating-point number.",
          return: "str",
        },
      },
      imag: "float",
      is_integer: {
        name: "is_integer",
        signature: {
          documentation: "Return True if the float is an integer.",
          return: "bool",
        },
      },
      real: "float",
    },
  },
  bool: {
    name: "bool",
    properties: {
      as_integer_ratio: {
        name: "as_integer_ratio",
        signature: {
          documentation:
            "Return a pair of integers, whose ratio is equal to the original int.",
          // TODO: this is known to be tuple[int, int]
          return: "tuple",
        },
      },
      bit_count: {
        name: "bit_count",
        signature: {
          documentation:
            "Number of ones in the binary representation of the absolute value of self.",
          return: "int",
        },
      },
      bit_length: {
        name: "bit_length",
        signature: {
          documentation:
            "Number of bits necessary to represent self in binary.",
          return: "int",
        },
      },
      conjugate: {
        name: "conjugate",
        signature: {
          documentation: "Returns self, the complex conjugate of any int.",
          return: "int",
        },
      },
      denominator: "int",
      from_bytes: {
        name: "from_bytes",
        signature: {
          documentation:
            "Return the integer represented by the given array of bytes.",
          arguments: [
            { name: "bytes" },
            { name: "byteorder", type: "str", default: '"big"' },
            { name: "signed", type: "bool", default: "False" },
          ],
          return: "int",
        },
      },
      imag: "int",
      is_integer: {
        name: "is_integer",
        signature: {
          documentation:
            "Returns True. Exists for duck type compatibility with float.is_integer.",
          return: "bool",
        },
      },
      numerator: "int",
      real: "int",
      to_bytes: {
        name: "to_bytes",
        signature: {
          documentation: "Return an array of bytes representing an integer.",
          return: { name: "bytes" },
        },
      },
    },
  },
  tuple: {
    name: "tuple",
    properties: {
      count: {
        name: "count",
        signature: {
          documentation: "Return number of occurrences of value.",
          arguments: [{ name: "value" }],
          return: "int",
        },
      },
      index: {
        name: "index",
        signature: {
          documentation: "Return first index of value.",
          arguments: [
            { name: "value" },
            { name: "start", type: "int", default: "0" },
            { name: "stop", type: "int", default: "sys.maxsize" },
          ],
          return: "int",
        },
      },
    },
  },
  list: {
    name: "list",
    properties: {
      append: {
        name: "append",
        signature: {
          documentation: "Append object to the end of the list.",
          arguments: [{ name: "object" }],
        },
      },
      clear: {
        name: "clear",
        signature: { documentation: "Remove all items from list." },
      },
      copy: {
        name: "copy",
        signature: {
          documentation: "Return a shallow copy of the list.",
          return: "list",
        },
      },
      count: {
        name: "count",
        signature: {
          documentation: "Return number of occurrences of value.",
          arguments: [{ name: "value" }],
          return: "int",
        },
      },
      extend: {
        name: "extend",
        signature: {
          documentation: "Extend list by appending elements from the iterable.",
          arguments: [{ name: "iterable" }],
        },
      },
      index: {
        name: "index",
        signature: {
          documentation: "Return first index of value.",
          arguments: [
            { name: "value" },
            { name: "start", type: "int", default: "0" },
            { name: "stop", type: "int", default: "sys.maxsize" },
          ],
          return: "int",
        },
      },
      insert: {
        name: "insert",
        signature: {
          documentation: "Insert object before index.",
          arguments: [{ name: "index", type: "int" }, { name: "object" }],
        },
      },
      pop: {
        name: "pop",
        signature: {
          documentation: "Remove and return item at index (default last).",
          arguments: [{ name: "index", type: "int", default: "-1" }],
          return: { name: "Any" },
        },
      },
      remove: {
        name: "remove",
        signature: {
          documentation: "Remove first occurrence of value.",
          arguments: [{ name: "value" }],
        },
      },
      reverse: {
        name: "reverse",
        signature: { documentation: "Reverse *IN PLACE*." },
      },
      sort: {
        name: "sort",
        signature: {
          documentation: "Sort the list in ascending order and return None.",
          arguments: [
            { name: "key", default: "None" },
            { name: "reverse", type: "bool", default: "False" },
          ],
        },
      },
    },
  },
  dict: {
    name: "dict",
    properties: {
      clear: {
        name: "clear",
        signature: { documentation: "Remove all items from the dict." },
      },
      copy: {
        name: "copy",
        signature: {
          documentation: "Return a shallow copy of the dict.",
          return: "dict",
        },
      },
      fromkeys: {
        name: "fromkeys",
        signature: {
          documentation:
            "Create a new dictionary with keys from iterable and values set to value.",
          arguments: [{ name: "iterable" }, { name: "value", default: "None" }],
          return: "dict",
        },
      },
      get: {
        name: "get",
        signature: {
          documentation:
            "Return the value for key if key is in the dictionary, else default.",
          arguments: [{ name: "key" }, { name: "default", default: "None" }],
        },
      },
      items: {
        name: "items",
        signature: {
          documentation:
            "Return a set-like object providing a view on the dict's items.",
        },
      },
      keys: {
        name: "keys",
        signature: {
          documentation:
            "Return a set-like object providing a view on the dict's keys.",
        },
      },
      popitem: {
        name: "popitem",
        signature: {
          documentation: "Remove and return a (key, value) pair as a 2-tuple.",
          return: "tuple",
        },
      },
      setdefault: {
        name: "setdefault",
        signature: {
          documentation:
            "Insert key with a value of default if key is not in the dictionary.",
          arguments: [{ name: "key" }, { name: "default" }],
        },
      },
      values: {
        name: "values",
        signature: {
          documentation:
            "Return an object providing a view on the dict's values.",
        },
      },
    },
  },
}
