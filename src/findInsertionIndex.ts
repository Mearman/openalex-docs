
export function findInsertionIndex(
  newLines: string[],
  currentIndex: number,
  lines: string[],
  offset: number
) {
  // Check if the current line is a Markdown line break
  const isMarkdownLineBreak = lines[currentIndex].trim().endsWith("\\");

  // Check for single-line code fence at the current index
  if (lines[currentIndex].trim().startsWith("```") &&
    lines[currentIndex].trim().endsWith("```")) {
    // The current line is a single-line code fence; insert after it
    return currentIndex + 1 + offset;
  }

  // Check for multi-line code fences
  let inCodeFence = false;
  for (let i = currentIndex; i >= 0; i--) {
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
    for (let i = currentIndex; i < lines.length; i++) {
      if (lines[i].trim() === "```") {
        return i + 1 + offset - newLines.length; // Insert before the end of the multi-line code fence
      }
    }
  } else if (isMarkdownLineBreak) {
    return currentIndex + 2 + offset; // Skip the next line due to Markdown line break
  }

  return currentIndex + 1 + offset; // Regular case, outside a code fence
}
