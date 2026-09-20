import { chromium } from "playwright-core"
import path from "node:path"

type ChromiumLaunchOptions = Parameters<typeof chromium.launch>[0]

function configuredExecutablePath(): string | undefined {
  return process.env.CHROMIUM_EXECUTABLE_PATH?.trim()
    || process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
    || undefined
}

async function loadServerlessChromium() {
  const chromiumPackage = await import("@sparticuz/chromium")
  return chromiumPackage.default
}

function bundledChromiumAssetsPath(): string {
  return path.join(process.cwd(), ".vercel-runtime", "chromium")
}

export async function resolveChromiumExecutablePath(): Promise<string | undefined> {
  const configuredPath = configuredExecutablePath()
  if (configuredPath) return configuredPath

  if (process.env.VERCEL === "1") {
    const serverlessChromium = await loadServerlessChromium()
    return serverlessChromium.executablePath(bundledChromiumAssetsPath())
  }

  return undefined
}

export async function createChromiumLaunchOptions(timeout: number): Promise<ChromiumLaunchOptions> {
  const isVercel = process.env.VERCEL === "1" && !configuredExecutablePath()
  const executablePath = await resolveChromiumExecutablePath()
  const serverlessChromium = isVercel ? await loadServerlessChromium() : null

  return {
    headless: true,
    timeout,
    args: isVercel
      ? Array.from(new Set([...(serverlessChromium?.args || []), "--no-sandbox", "--disable-setuid-sandbox"]))
      : ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(executablePath ? { executablePath } : {}),
  }
}
