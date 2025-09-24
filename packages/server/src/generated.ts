export const filters: Record<
  string,
  { brief: string; parameters: { name: string; default: string | null }[] }
> = {
  abs: { brief: "Return the absolute value of the argument.", parameters: [] },
  attr: {
    brief:
      'Get an attribute of an object. ``foo|attr("bar")`` works like ``foo.bar``, but returns undefined instead of falling back to ``foo["bar"]`` if the attribute doesn\'t exist.',
    parameters: [{ name: "name", default: null }],
  },
  batch: {
    brief:
      " A filter that batches items. It works pretty much like `slice` just the other way round. It returns a list of lists with the given number of items. If you provide a second parameter this is used to fill up missing items. See this example:",
    parameters: [
      { name: "linecount", default: null },
      { name: "fill_with", default: "None" },
    ],
  },
  capitalize: {
    brief:
      "Capitalize a value. The first character will be uppercase, all others lowercase. ",
    parameters: [],
  },
  center: {
    brief: "Centers the value in a field of a given width.",
    parameters: [{ name: "width", default: "80" }],
  },
  count: {
    brief: "Return the number of items in a container.",
    parameters: [],
  },
  d: {
    brief:
      "If the value is undefined it will return the passed default value, otherwise the value of the variable:",
    parameters: [
      { name: "default_value", default: "" },
      { name: "boolean", default: "False" },
    ],
  },
  default: {
    brief:
      "If the value is undefined it will return the passed default value, otherwise the value of the variable:",
    parameters: [
      { name: "default_value", default: "" },
      { name: "boolean", default: "False" },
    ],
  },
  dictsort: {
    brief:
      "Sort a dict and yield (key, value) pairs. Python dicts may not be in the order you want to display them in, so sort them first.",
    parameters: [
      { name: "case_sensitive", default: "False" },
      { name: "by", default: "key" },
      { name: "reverse", default: "False" },
    ],
  },
  e: {
    brief:
      "Replace the characters ``&``, ``<``, ``>``, ``'``, and ``\"`` in the string with HTML-safe sequences. Use this if you need to display text that might contain such characters in HTML.",
    parameters: [],
  },
  escape: {
    brief:
      "Replace the characters ``&``, ``<``, ``>``, ``'``, and ``\"`` in the string with HTML-safe sequences. Use this if you need to display text that might contain such characters in HTML.",
    parameters: [],
  },
  filesizeformat: {
    brief:
      "Format the value like a 'human-readable' file size (i.e. 13 kB, 4.1 MB, 102 Bytes, etc).  Per default decimal prefixes are used (Mega, Giga, etc.), if the second parameter is set to `True` the binary prefixes are used (Mebi, Gibi). ",
    parameters: [{ name: "binary", default: "False" }],
  },
  first: { brief: "Return the first item of a sequence.", parameters: [] },
  float: {
    brief:
      "Convert the value into a floating point number. If the conversion doesn't work it will return ``0.0``. You can override this default using the first parameter. ",
    parameters: [{ name: "default", default: "0.0" }],
  },
  forceescape: {
    brief:
      "Enforce HTML escaping.  This will probably double escape variables.",
    parameters: [],
  },
  format: {
    brief:
      "Apply the given values to a `printf-style`_ format string, like ``string % values``.",
    parameters: [
      { name: "args", default: null },
      { name: "kwargs", default: null },
    ],
  },
  groupby: {
    brief:
      "Group a sequence of objects by an attribute using Python's :func:`itertools.groupby`. The attribute can use dot notation for nested access, like ``\"address.city\"``. Unlike Python's ``groupby``, the values are sorted first so only one group is returned for each unique value.",
    parameters: [
      { name: "attribute", default: null },
      { name: "default", default: "None" },
      { name: "case_sensitive", default: "False" },
    ],
  },
  indent: {
    brief:
      "Return a copy of the string with each line indented by 4 spaces. The first line and blank lines are not indented by default.",
    parameters: [
      { name: "width", default: "4" },
      { name: "first", default: "False" },
      { name: "blank", default: "False" },
    ],
  },
  int: {
    brief:
      "Convert the value into an integer. If the conversion doesn't work it will return ``0``. You can override this default using the first parameter. You can also override the default base (10) in the second parameter, which handles input with prefixes such as 0b, 0o and 0x for bases 2, 8 and 16 respectively. The base is ignored for decimal numbers and non-string values. ",
    parameters: [
      { name: "default", default: "0" },
      { name: "base", default: "10" },
    ],
  },
  join: {
    brief:
      "Return a string which is the concatenation of the strings in the sequence. The separator between elements is an empty string per default, you can define it with the optional parameter:",
    parameters: [
      { name: "value", default: null },
      { name: "d", default: "" },
      { name: "attribute", default: "None" },
    ],
  },
  last: { brief: "Return the last item of a sequence.", parameters: [] },
  length: {
    brief: "Return the number of items in a container.",
    parameters: [],
  },
  list: {
    brief:
      "Convert the value into a list.  If it was a string the returned list will be a list of characters. ",
    parameters: [],
  },
  lower: { brief: "Convert a value to lowercase.", parameters: [] },
  items: {
    brief: "Return an iterator over the ``(key, value)`` items of a mapping.",
    parameters: [],
  },
  map: {
    brief:
      "Applies a filter on a sequence of objects or looks up an attribute. This is useful when dealing with lists of objects but you are really only interested in a certain value of it.",
    parameters: [
      { name: "value", default: null },
      { name: "args", default: null },
      { name: "kwargs", default: null },
    ],
  },
  min: {
    brief: "Return the smallest item from the sequence.",
    parameters: [
      { name: "case_sensitive", default: "False" },
      { name: "attribute", default: "None" },
    ],
  },
  max: {
    brief: "Return the largest item from the sequence.",
    parameters: [
      { name: "case_sensitive", default: "False" },
      { name: "attribute", default: "None" },
    ],
  },
  pprint: {
    brief: "Pretty print a variable. Useful for debugging.",
    parameters: [],
  },
  random: {
    brief: "Return a random item from the sequence.",
    parameters: [{ name: "seq", default: null }],
  },
  reject: {
    brief:
      "Filters a sequence of objects by applying a test to each object, and rejecting the objects with the test succeeding.",
    parameters: [
      { name: "value", default: null },
      { name: "args", default: null },
      { name: "kwargs", default: null },
    ],
  },
  rejectattr: {
    brief:
      "Filters a sequence of objects by applying a test to the specified attribute of each object, and rejecting the objects with the test succeeding.",
    parameters: [
      { name: "value", default: null },
      { name: "args", default: null },
      { name: "kwargs", default: null },
    ],
  },
  replace: {
    brief:
      "Return a copy of the value with all occurrences of a substring replaced with a new one. The first argument is the substring that should be replaced, the second is the replacement string. If the optional third argument ``count`` is given, only the first ``count`` occurrences are replaced:",
    parameters: [
      { name: "s", default: null },
      { name: "old", default: null },
      { name: "new", default: null },
      { name: "count", default: "None" },
    ],
  },
  reverse: {
    brief:
      "Reverse the object or return an iterator that iterates over it the other way round. ",
    parameters: [],
  },
  round: {
    brief:
      "Round the number to a given precision. The first parameter specifies the precision (default is ``0``), the second the rounding method:",
    parameters: [
      { name: "precision", default: "0" },
      { name: "method", default: "common" },
    ],
  },
  safe: {
    brief:
      "Mark the value as safe which means that in an environment with automatic escaping enabled this variable will not be escaped. ",
    parameters: [],
  },
  select: {
    brief:
      "Filters a sequence of objects by applying a test to each object, and only selecting the objects with the test succeeding.",
    parameters: [
      { name: "value", default: null },
      { name: "args", default: null },
      { name: "kwargs", default: null },
    ],
  },
  selectattr: {
    brief:
      "Filters a sequence of objects by applying a test to the specified attribute of each object, and only selecting the objects with the test succeeding.",
    parameters: [
      { name: "value", default: null },
      { name: "args", default: null },
      { name: "kwargs", default: null },
    ],
  },
  slice: {
    brief:
      "Slice an iterator and return a list of lists containing those items. Useful if you want to create a div containing three ul tags that represent columns:",
    parameters: [
      { name: "slices", default: null },
      { name: "fill_with", default: "None" },
    ],
  },
  sort: {
    brief: "Sort an iterable using Python's :func:`sorted`.",
    parameters: [
      { name: "reverse", default: "False" },
      { name: "case_sensitive", default: "False" },
      { name: "attribute", default: "None" },
    ],
  },
  string: {
    brief:
      "Convert an object to a string if it isn't already. This preserves a :class:`Markup` string rather than converting it back to a basic string, so it will still be marked as safe and won't be escaped again.",
    parameters: [],
  },
  striptags: {
    brief: "Strip SGML/XML tags and replace adjacent whitespace by one space.",
    parameters: [],
  },
  sum: {
    brief:
      "Returns the sum of a sequence of numbers plus the value of parameter 'start' (which defaults to 0).  When the sequence is empty it returns start.",
    parameters: [
      { name: "attribute", default: "None" },
      { name: "start", default: "0" },
    ],
  },
  title: {
    brief:
      "Return a titlecased version of the value. I.e. words will start with uppercase letters, all remaining characters are lowercase. ",
    parameters: [],
  },
  trim: {
    brief: "Strip leading and trailing characters, by default whitespace.",
    parameters: [{ name: "chars", default: "None" }],
  },
  truncate: {
    brief:
      'Return a truncated copy of the string. The length is specified with the first parameter which defaults to ``255``. If the second parameter is ``true`` the filter will cut the text at length. Otherwise it will discard the last word. If the text was in fact truncated it will append an ellipsis sign (``"..."``). If you want a different ellipsis sign than ``"..."`` you can specify it using the third parameter. Strings that only exceed the length by the tolerance margin given in the fourth parameter will not be truncated.',
    parameters: [
      { name: "s", default: null },
      { name: "length", default: "255" },
      { name: "killwords", default: "False" },
      { name: "end", default: "..." },
      { name: "leeway", default: "None" },
    ],
  },
  unique: {
    brief: "Returns a list of unique items from the given iterable.",
    parameters: [
      { name: "case_sensitive", default: "False" },
      { name: "attribute", default: "None" },
    ],
  },
  upper: { brief: "Convert a value to uppercase.", parameters: [] },
  urlencode: {
    brief: "Quote data for use in a URL path or query using UTF-8.",
    parameters: [],
  },
  urlize: {
    brief: "Convert URLs in text into clickable links.",
    parameters: [
      { name: "value", default: null },
      { name: "trim_url_limit", default: "None" },
      { name: "nofollow", default: "False" },
      { name: "target", default: "None" },
      { name: "rel", default: "None" },
      { name: "extra_schemes", default: "None" },
    ],
  },
  wordcount: { brief: "Count the words in that string.", parameters: [] },
  wordwrap: {
    brief:
      "Wrap a string to the given width. Existing newlines are treated as paragraphs to be wrapped separately.",
    parameters: [
      { name: "width", default: "79" },
      { name: "break_long_words", default: "True" },
      { name: "wrapstring", default: "None" },
      { name: "break_on_hyphens", default: "True" },
    ],
  },
  xmlattr: {
    brief: "Create an SGML/XML attribute string based on the items in a dict.",
    parameters: [
      { name: "d", default: null },
      { name: "autospace", default: "True" },
    ],
  },
  tojson: {
    brief:
      "Serialize an object to a string of JSON, and mark it safe to render in HTML. This filter is only for use in HTML documents.",
    parameters: [
      { name: "value", default: null },
      { name: "indent", default: "None" },
    ],
  },
}
export const tests: Record<
  string,
  { brief: string; parameters: { name: string; default: string | null }[] }
> = {
  odd: { brief: "Return true if the variable is odd.", parameters: [] },
  even: { brief: "Return true if the variable is even.", parameters: [] },
  divisibleby: {
    brief: "Check if a variable is divisible by a number.",
    parameters: [{ name: "num", default: null }],
  },
  defined: { brief: "Return true if the variable is defined:", parameters: [] },
  undefined: {
    brief: "Like :func:`defined` but the other way round.",
    parameters: [],
  },
  filter: {
    brief:
      "Check if a filter exists by name. Useful if a filter may be optionally available.",
    parameters: [{ name: "value", default: null }],
  },
  test: {
    brief:
      "Check if a test exists by name. Useful if a test may be optionally available.",
    parameters: [{ name: "value", default: null }],
  },
  none: { brief: "Return true if the variable is none.", parameters: [] },
  boolean: {
    brief: "Return true if the object is a boolean value.",
    parameters: [],
  },
  false: { brief: "Return true if the object is False.", parameters: [] },
  true: { brief: "Return true if the object is True.", parameters: [] },
  integer: {
    brief: "Return true if the object is an integer.",
    parameters: [],
  },
  float: { brief: "Return true if the object is a float.", parameters: [] },
  lower: {
    brief: "Return true if the variable is lowercased.",
    parameters: [],
  },
  upper: {
    brief: "Return true if the variable is uppercased.",
    parameters: [],
  },
  string: { brief: "Return true if the object is a string.", parameters: [] },
  mapping: {
    brief: "Return true if the object is a mapping (dict etc.).",
    parameters: [],
  },
  number: { brief: "Return true if the variable is a number.", parameters: [] },
  sequence: {
    brief:
      "Return true if the variable is a sequence. Sequences are variables that are iterable. ",
    parameters: [],
  },
  iterable: {
    brief: "Check if it's possible to iterate over an object.",
    parameters: [],
  },
  callable: {
    brief:
      "Return whether the object is callable (i.e., some kind of function).",
    parameters: [],
  },
  sameas: {
    brief:
      "Check if an object points to the same memory address than another object:",
    parameters: [{ name: "other", default: null }],
  },
  escaped: { brief: "Check if the value is escaped.", parameters: [] },
  in: {
    brief: "Check if value is in seq.",
    parameters: [{ name: "seq", default: null }],
  },
  "==": {
    brief: "Same as a == b.",
    parameters: [{ name: "b", default: null }],
  },
  eq: { brief: "Same as a == b.", parameters: [{ name: "b", default: null }] },
  equalto: {
    brief: "Same as a == b.",
    parameters: [{ name: "b", default: null }],
  },
  "!=": {
    brief: "Same as a != b.",
    parameters: [{ name: "b", default: null }],
  },
  ne: { brief: "Same as a != b.", parameters: [{ name: "b", default: null }] },
  ">": { brief: "Same as a > b.", parameters: [{ name: "b", default: null }] },
  gt: { brief: "Same as a > b.", parameters: [{ name: "b", default: null }] },
  greaterthan: {
    brief: "Same as a > b.",
    parameters: [{ name: "b", default: null }],
  },
  ge: { brief: "Same as a >= b.", parameters: [{ name: "b", default: null }] },
  ">=": {
    brief: "Same as a >= b.",
    parameters: [{ name: "b", default: null }],
  },
  "<": { brief: "Same as a < b.", parameters: [{ name: "b", default: null }] },
  lt: { brief: "Same as a < b.", parameters: [{ name: "b", default: null }] },
  lessthan: {
    brief: "Same as a < b.",
    parameters: [{ name: "b", default: null }],
  },
  "<=": {
    brief: "Same as a <= b.",
    parameters: [{ name: "b", default: null }],
  },
  le: { brief: "Same as a <= b.", parameters: [{ name: "b", default: null }] },
}
export const globals: Record<
  string,
  { brief: string; parameters: { name: string; default: string | null }[] }
> = {
  range: {
    brief:
      "range(stop) -> range object range(start, stop[, step]) -> range object",
    parameters: [
      { name: "args", default: null },
      { name: "kwargs", default: null },
    ],
  },
  dict: {
    brief:
      "dict() -> new empty dictionary dict(mapping) -> new dictionary initialized from a mapping object's     (key, value) pairs dict(iterable) -> new dictionary initialized as if via:     d = {}     for k, v in iterable:         d[k] = v dict(**kwargs) -> new dictionary initialized with the name=value pairs     in the keyword argument list.  For example:  dict(one=1, two=2)",
    parameters: [
      { name: "args", default: null },
      { name: "kwargs", default: null },
    ],
  },
  lipsum: {
    brief: "Generate some lorem ipsum for the template.",
    parameters: [
      { name: "html", default: "True" },
      { name: "min", default: "20" },
      { name: "max", default: "100" },
    ],
  },
  cycler: {
    brief:
      "Cycle through values by yield them one at a time, then restarting once the end is reached. Available as ``cycler`` in templates.",
    parameters: [{ name: "items", default: null }],
  },
  joiner: {
    brief: "A joining helper for templates.",
    parameters: [{ name: "sep", default: ", " }],
  },
  namespace: {
    brief:
      "A namespace object that can hold arbitrary attributes.  It may be initialized from a dictionary or with keyword arguments.",
    parameters: [{ name: "kwargs", default: null }],
  },
}
