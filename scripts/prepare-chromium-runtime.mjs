import { cp, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageEntry = fileURLToPath(import.meta.resolve("@sparticuz/chromium"))
const source = path.resolve(path.dirname(packageEntry), "../bin")
const destination = path.join(process.cwd(), ".vercel-runtime", "chromium")

await mkdir(destination, { recursive: true })
await cp(source, destination, { recursive: true, force: true })

console.log("Prepared serverless Chromium runtime assets.")
