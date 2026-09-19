#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const sourceRoots = [
  path.join(root, "app"),
  path.join(root, "components"),
  path.join(root, "lib"),
  path.join(root, "middleware.ts"),
  path.join(root, "instrumentation.ts"),
]
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"])
const checks = [
  {
    label: "placeholder link",
    pattern: /href\s*=\s*(?:\{\s*)?["']#["'](?:\s*\})?/g,
  },
  {
    label: "unfinished runtime copy",
    pattern: /\b(?:coming\s+soon|not\s+implemented|fixme|todo)\b/gi,
  },
  {
    label: "empty click handler",
    pattern: /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/g,
  },
]

function collectFiles(entry) {
  if (!fs.existsSync(entry)) return []
  const stats = fs.statSync(entry)
  if (stats.isFile()) return sourceExtensions.has(path.extname(entry)) ? [entry] : []

  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((child) => {
    if (child.name === "node_modules" || child.name.startsWith(".")) return []
    return collectFiles(path.join(entry, child.name))
  })
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length
}

const files = [...new Set(sourceRoots.flatMap(collectFiles))].sort()
const violations = []

for (const file of files) {
  const source = fs.readFileSync(file, "utf8")
  for (const check of checks) {
    check.pattern.lastIndex = 0
    for (const match of source.matchAll(check.pattern)) {
      violations.push(`${path.relative(root, file)}:${lineNumber(source, match.index ?? 0)} ${check.label}`)
    }
  }
}

if (violations.length > 0) {
  console.error("Production surface audit failed:")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log(`Production surface audit passed (${files.length} runtime files checked).`)
}
