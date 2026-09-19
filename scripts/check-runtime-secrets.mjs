#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const sourceRoots = [
  path.join(root, "app"),
  path.join(root, "components"),
  path.join(root, "lib"),
  path.join(root, "scripts"),
  path.join(root, "middleware.ts"),
  path.join(root, "instrumentation.ts"),
  path.join(root, ".github"),
]
const textExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".json", ".yml", ".yaml", ".toml"])
const secretPatterns = [
  { label: "private-key block", pattern: /-----BEGIN (?:RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----/g },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "GitHub token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g },
  { label: "Stripe secret key", pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { label: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9]{20,}\b/g },
  { label: "OpenRouter key", pattern: /\bsk-or-v1-[A-Za-z0-9]{20,}\b/g },
  { label: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
]

function collectFiles(entry) {
  if (!fs.existsSync(entry)) return []
  const stats = fs.statSync(entry)
  if (stats.isFile()) return textExtensions.has(path.extname(entry)) ? [entry] : []

  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((child) => {
    if (child.name === "node_modules" || child.name === ".git" || child.name === ".next") return []
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
  for (const check of secretPatterns) {
    check.pattern.lastIndex = 0
    for (const match of source.matchAll(check.pattern)) {
      violations.push(`${path.relative(root, file)}:${lineNumber(source, match.index ?? 0)} ${check.label}`)
    }
  }
}

if (violations.length > 0) {
  console.error("Runtime secret scan failed:")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log(`Runtime secret scan passed (${files.length} deployable files checked).`)
}
