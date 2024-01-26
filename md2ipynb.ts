#!/usr/bin/env npx -y tsx
import * as fs from "fs";
import * as path from "path";
// Define the structure of a Jupyter Notebook cell
interface BaseNotebookCell {
  cell_type: "markdown" | "code";
  metadata: {};
  source: string[];
}

interface CodeCell extends BaseNotebookCell {
  cell_type: "code";
  execution_count: number | null;
  outputs: any[];
}

interface MarkdownCell extends BaseNotebookCell {
  cell_type: "markdown";
}

type NotebookCell = CodeCell | MarkdownCell;

// Define the structure of a Jupyter Notebook
interface JupyterNotebook {
  cells: NotebookCell[];
  metadata: {
    kernelspec: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info: {
      codemirror_mode: {
        name: string;
        version: number;
      };
      file_extension: string;
      mimetype: string;
      name: string;
      pygments_lexer: string;
      version: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}

// Function to convert Markdown to a Jupyter Notebook
function convertMarkdownToJupyterNotebook(
  markdown: string,
  removeCells?: RegExp[],
  removeLines?: RegExp[]
): JupyterNotebook {
  const segments = markdown
    .trim()
    .split(/(```(?:python|bash|sh)\n[\s\S]*?\n```)/g);

  const cells = segments
    .map((segment): NotebookCell => {
      if (segment.startsWith("```python")) {
        return {
          cell_type: "code",
          metadata: {},
          source: segment.replace(/```python\n|```/g, "").split("\n"),
          outputs: [],
          execution_count: null,
        };
      } else if (segment.startsWith("```bash") || segment.startsWith("```sh")) {
        return {
          cell_type: "code",
          metadata: {},
          source: ["%%bash"].concat(
            segment.replace(/```(?:bash|sh)\n|```/g, "").split("\n")
          ),
          outputs: [],
          execution_count: null,
        };
      } else {
        return {
          cell_type: "markdown",
          metadata: {},
          source: segment.split("\n"),
        };
      }
    })
    .map((cell) => ({
      ...cell,
      source: cell.source.join("\n").trim().split("\n"),
    }))
    .filter((cell) => {
      if (!removeCells) {
        return true;
      } else if (removeCells.length > 0) {
        return !removeCells.some((regex) =>
          cell.source.join("\n").match(regex)
        );
      } else {
        return true;
      }
    })
    .map((cell) => {
      if (!removeLines || removeLines.length === 0) {
        return cell;
      }
      cell.source = cell.source.filter((line: string) => {
        if (removeLines && removeLines.length > 0) {
          return !removeLines.some((regex) => line.match(regex));
        } else {
          return true;
        }
      });
      return cell;
    })
    // add newline to all source lines except for the last
    .map((cell) => ({
      ...cell,
      source: cell.source.map((line, i) =>
        i === cell.source.length - 1 ? line : line + "\n"
      ),
    }));

  const notebook: JupyterNotebook = {
    cells: cells.filter((cell) => cell.source.join("\n").trim() !== ""),
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: {
        codemirror_mode: {
          name: "ipython",
          version: 3,
        },
        file_extension: ".py",
        mimetype: "text/x-python",
        name: "python",
        pygments_lexer: "ipython3",
        version: "3.8.5",
      },
    },
    nbformat: 4,
    nbformat_minor: 4,
  };

  return notebook;
}

function removeYamlHeaders(markdown: string): string {
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

export function main() {
  recursivelyProcessFilesInDir(
    ".",
    /^(?!.*node_modules).*\.md$/,
    (filepath: fs.PathLike, content: string) => {
      const markdownWithoutHeaders = removeYamlHeaders(content);
      const markdownWithApiCalls = convertApiUrlsToApiCalls(
        markdownWithoutHeaders,
        path.relative(__dirname, filepath.toString())
      );
      const contentHasUpdated: boolean = content !== markdownWithApiCalls;
      const markdownWithRelativeLinks = makeLinksRelative(markdownWithApiCalls);
      const markdownWithIpynbLinks = updateMdLinksToIpynb(
        markdownWithRelativeLinks,
        filepath,
        fs.existsSync
      );
      const notebook = convertMarkdownToJupyterNotebook(markdownWithIpynbLinks);

      const output = filepath
        .toString()
        .replace(/(\.[a-z0-9]+)+$/i, ".ipynb")
        .replace(/^\.\//, "");

      if (contentHasUpdated) {
        fs.writeFileSync(output, JSON.stringify(notebook, null, 2));
      }
      return notebook;
    }
  );
}

if (require.main === module) {
  main();
}

function recursivelyProcessFilesInDir(
  dir: string,
  match: RegExp,
  fn: (path: fs.PathLike, content: string) => any
) {
  dir = path.resolve(dir);
  console.log();
  console.log(`Processing ${dir}`);
  const files = fs.readdirSync(dir);
  for (const file of files) {
    console.log(`Processing ${file}`);
    const path = `${dir}/${file}`;
    const stat = fs.statSync(path);
    if (stat.isDirectory()) {
      recursivelyProcessFilesInDir(path, match, fn);
    } else if (stat.isFile() && file.match(match)) {
      // const output = `${path.replace(/(\.[a-z0-9]+)+$/i, "")}${outputFilename}`;
      const content = fs.readFileSync(path, "utf-8");
      fn(path, content);
    }
  }
}

function convertUrlToApiCallCodeFence(url: string) {
  const typedUrl = new URL(url);
  const pathname = typedUrl.pathname;
  const entity = pathname.split("/")[1];
  const id: string | undefined = pathname.split("/")[2];
  const searchParams = typedUrl.searchParams;
  const params: { key: string; value: string; }[] = Array.from(searchParams).map(
    ([key, value]) => ({ key, value })
  );

  const apiInstance = `${entity}_api`;

  // drop the s from the call if there is an id
  const call = id ? `get_${entity.slice(0, -1)}` : `get_${entity}`;

  // add the id to the call args if it exists
  if (id) {
    params.push({ key: "id", value: id });
  }
  const codeFence = [
    "```python",
    `response = ${apiInstance}.${call}(`,
    `\t${params
      .map(({ key, value }) => `${key.replace("-", "_")}="${value}"`)
      .join(",\n\t")}`,
    ")",
    "",
    // "print(json.dumps(response.to_dict(), indent=2))",
    "display(pd.DataFrame(response.results))",
    "```",
    "```python",
    // try and read value for openapi_token , error if nullish
    `try:`,
    `\topenapi_token`,
    `\tif openapi_token:`,
    `\t\tllm = OpenAI(token=openapi_token)`,
    "\tdf = pd.DataFrame(response.results)",
    `\tsdf = SmartDataframe(df, config={"llm": llm})`,
    `\tsdf.chat("Plot a chart of this data")`,
    `except:`,
    `\traise Exception("Please provide an openapi_token")`,

    "```",
  ].join("\n");
  console.log(codeFence);
  return codeFence;
}

type Match = {
  line: string;
  urls: { url: string[]; code: string; }[];
  i: number;
};

function convertApiUrlsToApiCalls(
  markdown: string,
  filename: fs.PathLike
): string {
  let lines = markdown.split("\n");
  const originalContent = markdown; // Save original content for comparison

  const pipCommand = `%pip install --upgrade "git+https://github.com/Mearman/openalex-python-pydantic-v1.git"`;
  const entities = [
    "authors",
    "concepts",
    "funders",
    "institutions",
    "publishers",
    "sources",
    "works",
  ];

  const owner = "Mearman";
  const repo = "openalex-docs";
  const branch = "main";
  let ipynbFilename = filename
    .toString()
    .replace(/(\.[a-z0-9]+)+$/i, ".ipynb")
    .replace(/^\.\//, "");

  const repoRootLink = `[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=GitHub&link=https://github.com/${owner}/${repo})](https://github.com/${owner}/${repo})`;

  const githubLink = `[![Open in GitHub](https://img.shields.io/badge/Open%20in-GitHub-181717?style=for-the-badge&logo=github&link=https://github.com/${owner}/${repo}/blob/${branch}/${ipynbFilename})](https://github.com/${owner}/${repo}/blob/${branch}/${ipynbFilename})`;

  const colabLink = `[![Open in Colab](https://img.shields.io/badge/Open%20in-Colab-F9AB00?style=for-the-badge&logo=Google%20Colab&link=https://colab.research.google.com/github/${owner}/${repo}/blob/${branch}/${ipynbFilename})](https://colab.research.google.com/github/${owner}/${repo}/blob/${branch}/${ipynbFilename})`;

  const pipInstallCodeFence = [
    repoRootLink + githubLink + colabLink,
    "```python",
    pipCommand,
    `%pip install pandasai`,
    "```",

    "```python",
    "import json",
    "import pandas as pd",
    "from openalex_api_pydantic_v1 import Configuration, ApiClient," +
    entities.map((e) => `${capitalize(e)}Api`).join(", "),
    "",
    `configuration = Configuration(host="https://api.openalex.org")`,
    entities
      .map((e) => `${e}_api = ${capitalize(e)}Api(ApiClient(configuration))`)
      .join("\n"),
    "```",

    "```python",
    "from pandasai import SmartDataframe",
    "from pandasai.llm import OpenAI",
    "```",

    "```python",
    `openapi_token = "" # @param {type:"string"}`,
    "```",
  ].join("\n");

  let apiCallModified = false; // Flag to track if any API call is modified or added
  let offset = 0;

  const matches: (Match | undefined)[] = lines.map((line, i) => {
    const urls = [
      ...new Set(
        line
          .match(/https:\/\/api.openalex.org\/[a-z]+[^)\s'\](`"]+/gi)
          ?.map((url) => url.replace(/\\_/g, "_").replace(/\\&/g, "&"))
      ),
    ];
    if (urls.length > 0) {
      return {
        line,
        urls: urls.map((url) => ({
          url: urls,
          code: convertUrlToApiCallCodeFence(url),
        })),
        i,
      };
    }
  });

  const filteredMatches: Match[] = matches.filter(Boolean) as Match[];

  if (filteredMatches.length > 0) {
    filteredMatches.forEach(({ urls, i }) => {
      if (urls.length > 0) {
        const codeFences = urls.map(({ code }) => code);
        codeFences.forEach((codeFence) => {
          if (!originalContent.includes(codeFence)) {
            const codeFenceLines = codeFence.split("\n");
            const insertionIndex = findInsertionIndex(
              codeFenceLines,
              i,
              lines,
              offset
            );
            const codeFenceLenght = codeFenceLines.length;
            lines.splice(insertionIndex, 0, ...codeFenceLines);
            offset += codeFenceLenght;
            apiCallModified = true;
          }
        });
      }
    });

    // Add pip install code fence only if an API call has been modified or added
    if (apiCallModified && !originalContent.includes(pipCommand)) {
      lines.unshift(pipInstallCodeFence);
    }
  }
  return lines.join("\n");
}
function findInsertionIndex(
  newLines: string[],
  currentIndex: number,
  lines: string[],
  offset: number
) {
  // Check if the current line is a Markdown line break
  const isMarkdownLineBreak = lines[currentIndex].trim().endsWith("\\");

  // Check for single-line code fence at the current index
  if (
    lines[currentIndex].trim().startsWith("```") &&
    lines[currentIndex].trim().endsWith("```")
  ) {
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

function capitalize(entity: string) {
  return entity.charAt(0).toUpperCase() + entity.slice(1);
}

function makeLinksRelative(conctent: string): string {
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

// type FileExistenceChecker = (path: string) => boolean;
type FileExistenceChecker = typeof fs.existsSync;

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

function updateMdLinksToIpynb(
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
