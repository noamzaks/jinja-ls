import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import typescript from "@rollup/plugin-typescript"

const plugins = [
  resolve(),
  commonjs(),
  typescript({ tsconfig: "./tsconfig.json" }),
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
]
