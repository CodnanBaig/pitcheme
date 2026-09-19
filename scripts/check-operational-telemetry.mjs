#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const routesRoot = path.join(root, "app", "api")

function collectRouteFiles(directory) {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return []
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectRouteFiles(fullPath)
    return entry.name === "route.ts" ? [fullPath] : []
  })
}

const routeFiles = collectRouteFiles(routesRoot).sort()
const violations = []

for (const file of routeFiles) {
  const source = fs.readFileSync(file, "utf8")
  if (/console\.error\s*\(/.test(source) && !source.includes("sendOperationalErrorTelemetry")) {
    violations.push(path.relative(root, file))
  }
}

if (violations.length > 0) {
  console.error("Operational telemetry audit failed; API routes log errors without bounded telemetry:")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log(`Operational telemetry audit passed (${routeFiles.length} API route files checked).`)
}
