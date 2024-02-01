export function removeYamlHeaders(markdown: string): string {
  const lines = markdown.split("\n");
  const yamlHeaderStart = lines.findIndex((line) => line.match(/^---\s*$/));
  if (yamlHeaderStart != -1) {
    const yamlHeaderEnd = lines.findIndex(
      (line, i) => i > yamlHeaderStart && line.match(/^---\s*$/)
    );
    if (yamlHeaderEnd != -1) {
      lines.splice(yamlHeaderStart, yamlHeaderEnd - yamlHeaderStart + 1);
    }
  }
  return lines.join("\n");
}
