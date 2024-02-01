export function makeLinksRelative(conctent: string): string {
  const lines = conctent.split("\n");
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  return lines
    .map((line) => {
      return line.replace(linkRegex, (match, text, url) => {
        // Split URL into the document path and the anchor
        const [path, anchor] = url.split("#");

        // Check if the link is a document link (not starting with http:// or https://)
        if (!/^https?:\/\//.test(path)) {
          let modifiedPath = path;

          // Prepend "./" if it's not there
          if (!modifiedPath.startsWith("./")) {
            modifiedPath = "./" + modifiedPath;
          }

          // Append "README.md" if the link ends with "/"
          if (modifiedPath.endsWith("/")) {
            modifiedPath += "README.md";
          }

          // Ensure the link ends with ".md" if it is not a directory
          else if (!modifiedPath.endsWith(".md")) {
            modifiedPath += ".md";
          }

          // Reconstruct the URL with the anchor if it was present
          url = modifiedPath + (anchor ? "#" + anchor : "");
        }

        // Return the modified link
        return `[${text}](${url})`;
      });
    })
    .join("\n");
}
