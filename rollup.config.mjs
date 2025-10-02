import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json"
import resolve from "@rollup/plugin-node-resolve"
import typescript from "@rollup/plugin-typescript"
import { globSync } from "fs"

const plugins = [
  resolve(),
  commonjs(),
  typescript({ tsconfig: "./tsconfig.json" }),
  json(),
]

export default [
  {
    input: "packages/server/src/server.ts",
    output: [
      {
        file: "dist/server.js",
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins,
  },
  {
    input: "packages/client/src/extension.ts",
    output: [
      {
        file: "dist/extension.js",
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins,
  },
  {
    input: globSync("packages/client/test/*.ts"),
    output: {
      format: "cjs",
      dir: "dist/tests",
    },
    plugins: [typescript({ tsconfig: "./packages/client/test/tsconfig.json" })],
  },
]
