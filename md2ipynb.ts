#!/usr/bin/env npx -y tsx
import * as fs from "fs";
import { PathLike } from "fs";

// Define the structure of a Jupyter Notebook cell
interface NotebookCell {
  cell_type: "markdown" | "code";
  metadata: {};
  source: string[];
}

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
        };
      } else if (segment.startsWith("```bash") || segment.startsWith("```sh")) {
        return {
          cell_type: "code",
          metadata: {},
          source: ["%%bash"].concat(
            segment.replace(/```(?:bash|sh)\n|```/g, "").split("\n")
          ),
        };
      } else {
        return {
          cell_type: "markdown",
          metadata: {},
          source: segment.split("\n"),
        };
      }
    })
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
    .map((cell) => {
      cell.source = cell.source.map((line) => line + "\n");
      return cell;
    });

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

export function markdown2notebook(input: fs.PathLike, output: fs.PathLike) {
  if (!input || !output) {
    console.error(`Invalid input or output: ${input} ${output}`);
    return;
  }
  console.log(`Converting ${input} to ${output}`);
  try {
    const markdownContent = fs.readFileSync(input, "utf-8");
    const notebook = convertMarkdownToJupyterNotebook(
      markdownContent,
      [], []);

    console.log(`Wrote ${output}`);
    return notebook;
  } catch (e) {
    console.log(e);
  }
}



export function main() {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) {
    recursivelyProcessFilesInDir(".", /^(?!.*node_modules).*\.md$/, ".md", convertApiUrlsToApiCalls);
    recursivelyProcessFilesInDir(".", /^(?!.*node_modules).*\.md$/, ".ipynb", markdown2notebook);
  }
  markdown2notebook(input, output);
}

if (require.main === module) {
  main();
}
function recursivelyProcessFilesInDir(dir: string, match: RegExp, outputFilename: string, fn: (input: fs.PathLike, output: fs.PathLike) => any) {
  console.log();
  console.log(`Processing ${dir}`);
  const files = fs.readdirSync(dir);
  for (const file of files) {
    console.log(`Processing ${file}`);
    const path = `${dir}/${file}`;
    const stat = fs.statSync(path);
    if (stat.isDirectory()) {
      recursivelyProcessFilesInDir(path, match, outputFilename, fn);
    } else if (stat.isFile() && file.match(match)) {
      // replace the file extension with the output extension
      const output = `${path.replace(/\.[^/.]+$/, "")}${outputFilename}`;
      fn(path, output);
    }
  }
}

function convertUrlToApiCallCodeFence(url: string) {
  const typedUrl = new URL(url);
  const pathname = typedUrl.pathname;
  const entity = pathname.split("/")[1];
  const id: string | undefined = pathname.split("/")[2];
  const searchParams = typedUrl.searchParams;
  // const params = Array.from(searchParams).map(([key, value]) => `${key}=${value}`).join("&");
  const params: { key: string, value: string; }[] = Array.from(searchParams).map(([key, value]) => ({ key, value }));

  const apiClass = `${capitalize(entity)}Api`;
  const apiInstance = `${entity}_api`;

  // drop the s from the call if there is an id
  const call = id ? `get_${entity.slice(0, -1)}` : `get_${entity}`;

  // add the id to the call args if it exists
  if (id) {
    params.push({ key: "id", value: id });
  }
  const codeFence = [
    "```python",
    `from openalex_api import ${apiClass}, Configuration`,
    "",
    `${apiInstance} = ${apiClass}(`,
    "\tConfiguration(",
    `\t\thost="https://api.openalex.org"`,
    `\t)`,
    `)`,
    "",
    `response = ${apiInstance}.${call}(`,
    `\t${params.map(({ key, value }) => `${key}="${value}"`).join(",\n\t")}`,
    ")",
    "",
    "print(json.dumps(response.to_dict(), indent=2))",
    "```"
  ].join("\n");
  console.log(codeFence);
  return codeFence;
}


function convertApiUrlsToApiCalls(input: PathLike, output: PathLike) {
  const file = fs.readFileSync(input, "utf-8");
  let lines: string[] = file.split("\n");
  lines = lines.map((line, i) => {
    if (line.includes("api.openalex.org") && !line.includes("](")) {
      const urls = [...new Set(line.match(/https:\/\/api.openalex.org\/[^)\s'"]+/g))];
      if (urls.length > 0) {
        const nextNonEmptyLineIndex = lines.slice(i + 1).findIndex(l => l.trim() !== '') + i + 1;
        const nextNonEmptyLine = lines[nextNonEmptyLineIndex];

        // Check if the next non-empty line is a code fence
        if (nextNonEmptyLine && nextNonEmptyLine.match(/^```/)) {
          // Add new code fence after the existing one
          const codeFence = Array.from(urls).map(url => convertUrlToApiCallCodeFence(url)).join("\n");
          lines.splice(nextNonEmptyLineIndex + 1, 0, codeFence);
        } else {
          // Add new code fence immediately after the current line
          const codeFence = Array.from(urls).map(url => convertUrlToApiCallCodeFence(url)).join("\n");
          return [line, codeFence].join("\n");
        }
      }
      return line;
    }
    return line;
  });
  fs.writeFileSync(output, lines.join("\n"));
}



function capitalize(entity: string) {
  return entity.charAt(0).toUpperCase() + entity.slice(1);
}

