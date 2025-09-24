import inspect
import json
from pathlib import Path

from jinja2.defaults import DEFAULT_FILTERS, DEFAULT_NAMESPACE, DEFAULT_TESTS


def process_items(items):
    result = {}
    for name, value in items.items():
        docstring: str = value.__doc__
        if isinstance(value, type):
            value = value.__init__
        s = inspect.signature(value)
        result[name] = {
            "brief": docstring.split("\n\n")[0].replace("\n", " "),
            "parameters": [
                {
                    "name": parameter.name,
                    "default": str(parameter.default)
                    if parameter.default is not inspect._empty
                    else None,
                }
                for parameter in s.parameters.values()
                if parameter.name != "environment"
            ][1:],
        }
    return result


if __name__ == "__main__":
    filters = process_items(DEFAULT_FILTERS)
    tests = process_items(DEFAULT_TESTS)
    globals = process_items(DEFAULT_NAMESPACE)

    Path("packages/server/src/generated.ts").write_text(
        f"export const filters: Record<string, {{ brief: string, parameters: {{ name: string, default: string | null }}[] }}> = {json.dumps(filters)}\n"
        f"export const tests: Record<string, {{ brief: string, parameters: {{ name: string, default: string | null }}[] }}> = {json.dumps(tests)}\n"
        f"export const globals: Record<string, {{ brief: string, parameters: {{ name: string, default: string | null }}[] }}> = {json.dumps(globals)}\n"
    )
