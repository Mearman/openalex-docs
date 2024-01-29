import { Insertion } from "./convertApiUrlsToApiCalls";

export function findInsertionIndex(
  newLines: string[],
  matchedLine: number,
  lines: string[],
  // offset: number
): Insertion {
  // Check if the current line is a Markdown line break
  const isMarkdownLineBreak = lines[matchedLine].trim().endsWith("\\");

  // Check for single-line code fence at the current index
  if (lines[matchedLine - 1].trim().startsWith("```") &&
      lines[matchedLine + 1].trim().endsWith("```")) {
    // The current line is a single-line code fence; insert after it
    return {lines: newLines, index: matchedLine + 1}
  }

  // Check for multi-line code fences
  let inCodeFence = false;
  for (let i = matchedLine; i >= 0; i--) {
    if (lines[i].trim() === "```") {
      inCodeFence = !inCodeFence;
      if (!inCodeFence) {
        // Found the start of the multi-line code fence; break
        break;
      }
    }
  }

  if (inCodeFence) {
    // Find the end of the multi-line code fence
    for (let i = matchedLine; i < lines.length; i++) {
      if (lines[i].trim() === "```") {
        return {
          lines: newLines,
          index: i + 1 - newLines.length // Insert before the end of the multi-line code fence}
        }
      }
    }
  } else if (isMarkdownLineBreak) {
    return {lines: newLines, index: matchedLine + 2}
  }

  return {lines: newLines, index: matchedLine + 1}
}
