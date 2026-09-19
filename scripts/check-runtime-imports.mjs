#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const sourceDirectories = ["app", "components", "lib"]
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"]
const intentionallyTestScoped = new Set(["lib/ai-evaluation.ts"])
const files = []

function walk(directory) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(fullPath)
    else if (sourceExtensions.includes(path.extname(fullPath))) files.push(fullPath)
  }
}

for (const directory of sourceDirectories) walk(path.join(root, directory))
for (const rootFile of ["middleware.ts", "instrumentation.ts"]) {
  const fullPath = path.join(root, rootFile)
  if (fs.existsSync(fullPath)) files.push(fullPath)
}

function withoutExtension(filePath) {
  return filePath.slice(0, -path.extname(filePath).length)
}

const filesByModule = new Map()
for (const file of files) {
  filesByModule.set(withoutExtension(file), file)
  if (path.basename(withoutExtension(file)) === "index") {
    filesByModule.set(withoutExtension(file).slice(0, -6), file)
  }
}

function resolveModule(importer, specifier) {
  const base = specifier.startsWith("@/")
    ? path.join(root, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(importer), specifier)
      : undefined
  if (!base) return undefined

  if (filesByModule.has(base)) return filesByModule.get(base)
  for (const extension of sourceExtensions) {
    if (filesByModule.has(base + extension)) return filesByModule.get(base + extension)
  }
  for (const extension of sourceExtensions) {
    const indexPath = path.join(base, `index${extension}`)
    if (filesByModule.has(indexPath)) return filesByModule.get(indexPath)
  }
  return undefined
}

function importsFrom(file) {
  const source = fs.readFileSync(file, "utf8")
  return [...source.matchAll(/(?:from|import\s*\()[\s]*["']([^"']+)["']/g)].map((match) => match[1])
}

const roots = files.filter((file) =>
  /(^|\/)(page|layout|route|loading|error|not-found)\.(ts|tsx|js|jsx)$/.test(file)
  || /^(middleware|instrumentation)\.(ts|tsx|js|jsx)$/.test(path.basename(file)),
)
const reachable = new Set(roots)
const queue = [...roots]

while (queue.length > 0) {
  const importer = queue.shift()
  for (const specifier of importsFrom(importer)) {
    const imported = resolveModule(importer, specifier)
    if (imported && !reachable.has(imported)) {
      reachable.add(imported)
      queue.push(imported)
    }
  }
}

const unreachable = files
  .filter((file) => !reachable.has(file))
  .map((file) => path.relative(root, file).replaceAll(path.sep, "/"))
  .filter((file) => !intentionallyTestScoped.has(file))
  .sort()

if (unreachable.length > 0) {
  console.error("Runtime import audit failed; unreachable modules:")
  for (const file of unreachable) console.error(`- ${file}`)
  process.exitCode = 1
} else {
  console.log(`Runtime import audit passed (${reachable.size} reachable modules; ${intentionallyTestScoped.size} test-scoped exception).`)
}
