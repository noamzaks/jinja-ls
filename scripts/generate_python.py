import inspect
import json
from pathlib import Path
from typing import Any, List


def get_types(objects: List[Any]):
    result = {}

    builtin_types = {type(s) for s in objects}

    for s in objects:
        typename = type(s).__name__
        result[typename] = {"name": typename, "properties": {}}

        for pname in dir(s):
            if pname.startswith("_"):
                continue

            pvalue = getattr(s, pname)

            if type(pvalue) in builtin_types:
                result[typename]["properties"][pname] = type(pvalue).__name__
                continue

            try:
                signature = inspect.signature(pvalue)
                result[typename]["properties"][pname] = {
                    "name": pname,
                    "signature": {
                        "documentation": inspect.getdoc(pvalue).split("\n\n")[0]
                    },
                }
                continue
            except ValueError:
                pass

    return result


if __name__ == "__main__":
    builtin_types = get_types(["hello", 1, 1.1, False])
    output_file = Path("packages/server/src/builtinTypes.ts")
    output_file.write_text(
        f"""import type {{ TypeInfo }} from "./types"\n\nexport const BUILTIN_TYPES: Record<string, TypeInfo> = {json.dumps(builtin_types)}"""
    )
