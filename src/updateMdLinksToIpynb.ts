import * as fs from "fs";
import * as path from "path";
import { FileExistenceChecker } from "./md2ipynb";

// function updateMdLinksToIpynb(content: string, fileExists: FileExistenceChecker = fs.existsSync): string {
// 	const lines = content.split("\n");
// 	const mdLinkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
// 	return lines.map(line => {
// 		return line.replace(mdLinkRegex, (match, text, mdPath) => {
// 			const ipynbPath = mdPath.replace(/\.md$/, '.ipynb');
// 			// Check if the .ipynb file exists
// 			if (fileExists(ipynbPath)) {
// 				// Update the link to point to the .ipynb file
// 				return `[${text}](${ipynbPath})`;
// 			}
// 			// If .ipynb file does not exist, keep the .md link
// 			return match;
// 		});
// 	}).join("\n");
// }
export function updateMdLinksToIpynb(
  content: string,
  sourceFile: fs.PathLike,
  fileExists: FileExistenceChecker = fs.existsSync
): string {
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  const lines = content.split("\n");
  const baseDir = path.dirname(sourceFile.toString());

  return lines
    .map((line) => {
      return line.replace(mdLinkRegex, (match, text, mdPath) => {
        // Construct the absolute path for the .md file
        const absoluteMdPath = path.join(baseDir, mdPath);
        // Construct the absolute path for the corresponding .ipynb file
        const absoluteIpynbPath = absoluteMdPath.replace(/\.md$/, ".ipynb");

        // Check if the .ipynb file exists
        if (fileExists(absoluteIpynbPath)) {
          // Construct the relative path for the .ipynb file
          const relativeIpynbPath = mdPath.replace(/\.md$/, ".ipynb");
          return `[${text}](${relativeIpynbPath})`;
        }

        // If .ipynb file does not exist, keep the .md link
        return match;
      });
    })
    .join("\n");
}
