import type { TypeInfo } from "./types"

export const BUILTIN_TYPES: Record<string, TypeInfo> = {
  str: {
    name: "str",
    properties: {
      capitalize: {
        name: "capitalize",
        signature: {
          documentation: "Return a capitalized version of the string.",
        },
      },
      casefold: {
        name: "casefold",
        signature: {
          documentation:
            "Return a version of the string suitable for caseless comparisons.",
        },
      },
      center: {
        name: "center",
        signature: {
          documentation: "Return a centered string of length width.",
        },
      },
      encode: {
        name: "encode",
        signature: {
          documentation:
            "Encode the string using the codec registered for encoding.",
        },
      },
      expandtabs: {
        name: "expandtabs",
        signature: {
          documentation:
            "Return a copy where all tab characters are expanded using spaces.",
        },
      },
      format: {
        name: "format",
        signature: {
          documentation:
            "Return a formatted version of the string, using substitutions from args and kwargs.\nThe substitutions are identified by braces ('{' and '}').",
        },
      },
      format_map: {
        name: "format_map",
        signature: {
          documentation:
            "Return a formatted version of the string, using substitutions from mapping.\nThe substitutions are identified by braces ('{' and '}').",
        },
      },
      isalnum: {
        name: "isalnum",
        signature: {
          documentation:
            "Return True if the string is an alpha-numeric string, False otherwise.",
        },
      },
      isalpha: {
        name: "isalpha",
        signature: {
          documentation:
            "Return True if the string is an alphabetic string, False otherwise.",
        },
      },
      isascii: {
        name: "isascii",
        signature: {
          documentation:
            "Return True if all characters in the string are ASCII, False otherwise.",
        },
      },
      isdecimal: {
        name: "isdecimal",
        signature: {
          documentation:
            "Return True if the string is a decimal string, False otherwise.",
        },
      },
      isdigit: {
        name: "isdigit",
        signature: {
          documentation:
            "Return True if the string is a digit string, False otherwise.",
        },
      },
      isidentifier: {
        name: "isidentifier",
        signature: {
          documentation:
            "Return True if the string is a valid Python identifier, False otherwise.",
        },
      },
      islower: {
        name: "islower",
        signature: {
          documentation:
            "Return True if the string is a lowercase string, False otherwise.",
        },
      },
      isnumeric: {
        name: "isnumeric",
        signature: {
          documentation:
            "Return True if the string is a numeric string, False otherwise.",
        },
      },
      isprintable: {
        name: "isprintable",
        signature: {
          documentation:
            "Return True if all characters in the string are printable, False otherwise.",
        },
      },
      isspace: {
        name: "isspace",
        signature: {
          documentation:
            "Return True if the string is a whitespace string, False otherwise.",
        },
      },
      istitle: {
        name: "istitle",
        signature: {
          documentation:
            "Return True if the string is a title-cased string, False otherwise.",
        },
      },
      isupper: {
        name: "isupper",
        signature: {
          documentation:
            "Return True if the string is an uppercase string, False otherwise.",
        },
      },
      join: {
        name: "join",
        signature: { documentation: "Concatenate any number of strings." },
      },
      ljust: {
        name: "ljust",
        signature: {
          documentation: "Return a left-justified string of length width.",
        },
      },
      lower: {
        name: "lower",
        signature: {
          documentation: "Return a copy of the string converted to lowercase.",
        },
      },
      lstrip: {
        name: "lstrip",
        signature: {
          documentation:
            "Return a copy of the string with leading whitespace removed.",
        },
      },
      partition: {
        name: "partition",
        signature: {
          documentation:
            "Partition the string into three parts using the given separator.",
        },
      },
      removeprefix: {
        name: "removeprefix",
        signature: {
          documentation:
            "Return a str with the given prefix string removed if present.",
        },
      },
      removesuffix: {
        name: "removesuffix",
        signature: {
          documentation:
            "Return a str with the given suffix string removed if present.",
        },
      },
      replace: {
        name: "replace",
        signature: {
          documentation:
            "Return a copy with all occurrences of substring old replaced by new.",
        },
      },
      rjust: {
        name: "rjust",
        signature: {
          documentation: "Return a right-justified string of length width.",
        },
      },
      rpartition: {
        name: "rpartition",
        signature: {
          documentation:
            "Partition the string into three parts using the given separator.",
        },
      },
      rsplit: {
        name: "rsplit",
        signature: {
          documentation:
            "Return a list of the substrings in the string, using sep as the separator string.",
        },
      },
      rstrip: {
        name: "rstrip",
        signature: {
          documentation:
            "Return a copy of the string with trailing whitespace removed.",
        },
      },
      split: {
        name: "split",
        signature: {
          documentation:
            "Return a list of the substrings in the string, using sep as the separator string.",
        },
      },
      splitlines: {
        name: "splitlines",
        signature: {
          documentation:
            "Return a list of the lines in the string, breaking at line boundaries.",
        },
      },
      strip: {
        name: "strip",
        signature: {
          documentation:
            "Return a copy of the string with leading and trailing whitespace removed.",
        },
      },
      swapcase: {
        name: "swapcase",
        signature: {
          documentation:
            "Convert uppercase characters to lowercase and lowercase characters to uppercase.",
        },
      },
      title: {
        name: "title",
        signature: {
          documentation:
            "Return a version of the string where each word is titlecased.",
        },
      },
      translate: {
        name: "translate",
        signature: {
          documentation:
            "Replace each character in the string using the given translation table.",
        },
      },
      upper: {
        name: "upper",
        signature: {
          documentation: "Return a copy of the string converted to uppercase.",
        },
      },
      zfill: {
        name: "zfill",
        signature: {
          documentation:
            "Pad a numeric string with zeros on the left, to fill a field of the given width.",
        },
      },
    },
  },
  int: {
    name: "int",
    properties: {
      as_integer_ratio: {
        name: "as_integer_ratio",
        signature: {
          documentation:
            "Return a pair of integers, whose ratio is equal to the original int.",
        },
      },
      bit_count: {
        name: "bit_count",
        signature: {
          documentation:
            "Number of ones in the binary representation of the absolute value of self.",
        },
      },
      bit_length: {
        name: "bit_length",
        signature: {
          documentation:
            "Number of bits necessary to represent self in binary.",
        },
      },
      conjugate: {
        name: "conjugate",
        signature: {
          documentation: "Returns self, the complex conjugate of any int.",
        },
      },
      denominator: "int",
      from_bytes: {
        name: "from_bytes",
        signature: {
          documentation:
            "Return the integer represented by the given array of bytes.",
        },
      },
      imag: "int",
      is_integer: {
        name: "is_integer",
        signature: {
          documentation:
            "Returns True. Exists for duck type compatibility with float.is_integer.",
        },
      },
      numerator: "int",
      real: "int",
      to_bytes: {
        name: "to_bytes",
        signature: {
          documentation: "Return an array of bytes representing an integer.",
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
        },
      },
      conjugate: {
        name: "conjugate",
        signature: {
          documentation: "Return self, the complex conjugate of any float.",
        },
      },
      fromhex: {
        name: "fromhex",
        signature: {
          documentation:
            "Create a floating-point number from a hexadecimal string.",
        },
      },
      hex: {
        name: "hex",
        signature: {
          documentation:
            "Return a hexadecimal representation of a floating-point number.",
        },
      },
      imag: "float",
      is_integer: {
        name: "is_integer",
        signature: { documentation: "Return True if the float is an integer." },
      },
      real: "float",
    },
  },
}
