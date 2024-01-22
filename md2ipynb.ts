#!/usr/bin/env npx -y tsx
import * as fs from "fs";
import { PathLike } from "fs";

// Define the structure of a Jupyter Notebook cell
interface BaseNotebookCell {
  cell_type: "markdown" | "code";
  metadata: {};
  source: string[];
}

interface CodeCell extends BaseNotebookCell {
  cell_type: "code";
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
        };
      } else if (segment.startsWith("```bash") || segment.startsWith("```sh")) {
        return {
          cell_type: "code",
          metadata: {},
          source: ["%%bash"].concat(
            segment.replace(/```(?:bash|sh)\n|```/g, "").split("\n")
          ),
          outputs: [],
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
    fs.writeFileSync(output, JSON.stringify(notebook, null, 2));
    // remove the input file
    fs.unlinkSync(input.toString());
    return notebook;
  } catch (e) {
    console.log(e);
  }
}



export function main() {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) {
    recursivelyProcessFilesInDir(".", /^(?!.*node_modules).*[^(py)]\.md$/, ".py.md", convertApiUrlsToApiCalls);
    recursivelyProcessFilesInDir(".", /^(?!.*node_modules).*\.py\.md$/, ".ipynb", markdown2notebook);
  }
  // markdown2notebook(input, output);
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
      const output = `${path.replace(/(\.[a-z0-9]+)+$/i, "")}${outputFilename}`;
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
  let lines = file.split("\n");
  const originalContent = file; // Save original content for comparison

  const pipCommand = `%pip install --upgrade "git+https://github.com/Mearman/openalex-python.git"`;
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
  let ipynbFilename = input.toString().replace(/\.md$/, ".ipynb").replace(/^\.\//, "");

  const colabLink = `[![Open All Collab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/${owner}/${repo}/blob/main/${ipynbFilename})`;
  const pipInstallCodeFence = [
    colabLink,
    "```python",
    pipCommand,
    "```",
    "```python",
    "import json",
    "from openalex_api import Configuration, ApiClient," + entities.map(e => `${capitalize(e)}Api`).join(", "),
    "",
    `configuration = Configuration(host="https://api.openalex.org")`,
    entities.map(e => `${e}_api = ${capitalize(e)}Api(ApiClient(configuration))`).join("\n"),
    "```",
  ].join("\n");;

  let apiCallModified = false; // Flag to track if any API call is modified or added

  let linesAddedSoFar = 0;

  lines.forEach((line, i) => {
    const urls = [...new Set(line.match(/https:\/\/api.openalex.org\/[a-z]+[^)\s'\]\(`'"]+/gi)?.map(url => url.replace(/\\_/g, "_").replace(/\\&/g, "&")))];

    if (urls.length > 0) {
      apiCallModified = true; // Set flag to true as an API call is modified or added
      const codeFences = urls.map(url => convertUrlToApiCallCodeFence(url));
      codeFences.forEach(codeFence => {
        if (!file.includes(codeFence)) {
          const insertionIndex = findInsertionIndex(i, lines, linesAddedSoFar);
          lines.splice(insertionIndex, 0, ...codeFence.split("\n"));
          linesAddedSoFar += codeFence.split("\n").length;
        }
      });
    }
  });

  // Add pip install code fence only if an API call has been modified or added
  if (apiCallModified && !file.includes(pipCommand)) {
    lines.unshift(pipInstallCodeFence);
  }

  const updatedContent = lines.join("\n");
  if (originalContent !== updatedContent) {
    fs.writeFileSync(output, updatedContent);
  } else {
    console.log("No changes made");
  }
}

function findInsertionIndex(currentIndex: number, lines: string[], linesAddedSoFar: number) {
  let inCodeFence = false;
  let codeFenceEndIndex = currentIndex;

  // Check if the current line is a Markdown line break
  const isMarkdownLineBreak = lines[currentIndex].trim().endsWith('\\');

  for (let i = currentIndex; i >= 0; i--) {
    if (lines[i].trim() === "```") {
      inCodeFence = !inCodeFence;
      if (!inCodeFence) {
        break;
      }
    }
    if (inCodeFence) {
      codeFenceEndIndex = i;
    }
  }

  if (inCodeFence) {
    for (let i = codeFenceEndIndex; i < lines.length; i++) {
      if (lines[i].trim() === "```") {
        return i + 1 + linesAddedSoFar; // Adjusted for added lines
      }
    }
  } else if (isMarkdownLineBreak) {
    return currentIndex + 2 + linesAddedSoFar; // Skip the next line as well due to Markdown line break
  }

  return currentIndex + 1 + linesAddedSoFar; // Adjusted for added lines
}





function capitalize(entity: string) {
  return entity.charAt(0).toUpperCase() + entity.slice(1);
}


function isLineInCodeFence(index: number, lines: string[]) {
  let inCodeFence = false;
  for (let i = 0; i <= index; i++) {
    if (lines[i].trim().match(/^```/)) {
      inCodeFence = !inCodeFence;
    }
  }
  return inCodeFence;
}

function findCodeFenceSartLine(index: number, lines: string[]) {
  let startLine = 0;
  for (let i = 0; i <= index; i++) {
    if (lines[i].trim().match(/^```/)) {
      startLine = i;
    }
  }
  return startLine;
}

function findCodeFenceEndLine(index: any, lines: string | any[]) {
  let endLine = 0;
  for (let i = index; i < lines.length; i++) {
    if (lines[i].trim().match(/^```/)) {
      endLine = i;
    }
  }
  return endLine;
}
