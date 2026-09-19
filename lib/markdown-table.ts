export interface MarkdownTable {
  headers: string[]
  rows: string[][]
  pricing: boolean
}

const MAX_TABLE_COLUMNS = 8
const MAX_TABLE_ROWS = 50
const MAX_CELL_LENGTH = 500

function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  const withoutLeadingPipe = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed
  const body = withoutLeadingPipe.endsWith("|")
    ? withoutLeadingPipe.slice(0, -1)
    : withoutLeadingPipe
  const cells: string[] = []
  let current = ""

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    const nextCharacter = body[index + 1]
    if (character === "\\" && (nextCharacter === "|" || nextCharacter === "\\")) {
      current += nextCharacter
      index += 1
    } else if (character === "|") {
      cells.push(current.trim())
      current = ""
    } else {
      current += character
    }
  }

  cells.push(current.trim())
  return cells.slice(0, MAX_TABLE_COLUMNS).map((cell) => cell.slice(0, MAX_CELL_LENGTH))
}

function isTableRow(line: string): boolean {
  return line.includes("|") && splitTableRow(line).length >= 2
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function isPricingHeader(headers: string[]): boolean {
  return headers.some((header) => /(?:price|cost|amount|fee|total|budget|rate)/i.test(header))
}

/**
 * Parse a bounded GitHub-flavoured Markdown table starting at `start`.
 * Invalid or incomplete table-looking content remains ordinary document text.
 */
export function parseMarkdownTableBlock(
  lines: string[],
  start: number,
): { table: MarkdownTable; nextIndex: number } | null {
  const headerLine = lines[start]
  const separatorLine = lines[start + 1]
  if (!headerLine || !separatorLine || !isTableRow(headerLine) || !isTableRow(separatorLine)) return null

  const headers = splitTableRow(headerLine)
  const separator = splitTableRow(separatorLine)
  if (headers.length < 2 || separator.length !== headers.length || !isSeparatorRow(separator)) return null

  const rows: string[][] = []
  let nextIndex = start + 2
  while (nextIndex < lines.length && rows.length < MAX_TABLE_ROWS) {
    const line = lines[nextIndex]
    if (!line.trim() || !isTableRow(line)) break
    const cells = splitTableRow(line)
    if (cells.length !== headers.length || isSeparatorRow(cells)) break
    rows.push(cells)
    nextIndex += 1
  }

  if (rows.length === 0) return null

  // Consume additional contiguous rows after the rendering cap so they are
  // not emitted as unstyled paragraphs after the bounded table.
  while (nextIndex < lines.length && lines[nextIndex].trim() && isTableRow(lines[nextIndex])) {
    nextIndex += 1
  }

  return {
    table: { headers, rows, pricing: isPricingHeader(headers) },
    nextIndex,
  }
}
