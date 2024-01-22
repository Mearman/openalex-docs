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
    // recursivelyProcessFilesInDir(".", /^(?!.*node_modules).*\.md$/, ".ipynb", markdown2notebook);
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
    // `# ${url}`,
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
  let lines = file.split("\n");
  const untouchedLines: string[] = lines;

  const pipCommand = `%pip install --upgrade --no-cache-dir "git+https://github.com/Mearman/openalex-python.git"`;
  // Define the pip install code fence
  const pipInstallCodeFence = [
    "```python",
    pipCommand,
    "```"
  ].join("\n");

  // Check if the file already contains the pip install code fence
  const containsPipInstall = lines.some(line => line.includes(pipCommand));

  // If not, add the pip install code fence at the start
  let codeFenceAdded = false;

  lines.forEach((line, i) => {
    // if (line.includes("api.openalex.org") && !line.includes("](")) {
    // const urls = [...new Set(line.match())];
    //   [`https://api.openalex.org/authors?filter=display_name.search:tupolev`](https://api.openalex.org/authors?filter=display\_name.search:tupolev)
    // const urls = [...new Set(line.match(/https:\/\/api.openalex.org\/[^)\s'"]+/g)?.map(url => url.replace("\\_", "_")))];
    const urls = [...new Set(
      line.match(
        /https:\/\/api.openalex.org\/[a-z]+[^)\s'\]\(`'"]+/gi
      )?.map(
        // replace all instances of \_ with _
        url => url.replace(/\\_/g, "_")
          // replace \& with &
          .replace(/\\&/g, "&")
      )
    )];

    if (urls.length > 1) {
      console.log(`Found ${urls.length} urls in line ${i}`);
    }
    if (urls.length > 0) {
      const codeFences = [...new Set(urls.map(url => convertUrlToApiCallCodeFence(url)))];

      // moving outwards from the current line, detect if it is within the opening and closing tags for a code fence
      // const openingCodeFenceIndex = lines.slice(0, i).reverse().findIndex(l => l.trim() === "```") + i;
      // const closingCodeFenceIndex = lines.slice(i + 1).findIndex(l => l.trim() === "```") + i + 1;
      // const withinCodeFence = openingCodeFenceIndex > closingCodeFenceIndex;
      const inCodefence = isLineInCodeFence(i, lines);

      let targetLineIndex = i + 1;
      if (inCodefence.isInCodeFence) {
        targetLineIndex = inCodefence.endLine + 1;
      }

      // detect if codefence has already been added
      // const codeFenceAlreadyAdded = lines.slice(0, targetLineIndex).some(l => l.includes(codeFences[0]));

      // if (!codeFenceAlreadyAdded) {
      // add the pip install code fence if it hasn't already been added

      // splice into the array at the target line index
      console.log(`Adding code fence at line ${targetLineIndex}`);
      const codeFencesArrayString = codeFences.join("\n\n");
      const codeFenceString = codeFencesArrayString;

      let containsCodeFence = false;

      // if lines does not contain codefence at any point then add it
      for (let i = 0; i < lines.length - codeFenceString.split("\n").length; i++) {
        const linesToCheck = lines.slice(i, i + codeFenceString.split("\n").length);
        const linesToCheckString = linesToCheck.join("\n");
        if (linesToCheckString === codeFenceString) {
          containsCodeFence = true;
          break;
        }
      }
      if (!containsCodeFence) {
        // lines.splice(targetLineIndex, 0, codeFenceString);
        const linesBefore = lines.slice(0, targetLineIndex);
        const linesAfter = lines.slice(targetLineIndex);
        lines = [
          ...linesBefore,
          ...codeFenceString.split("\n"),
          ...linesAfter
        ];
      } else {
        console.log("Code fence already added");
        // }
      }

      if (!containsPipInstall && !codeFenceAdded) {
        console.log("Adding pip install code fence");
        lines = pipInstallCodeFence.split("\n").concat(lines);
        codeFenceAdded = true;
      }
    }
  });

  if (untouchedLines != lines) {
    fs.writeFileSync(output, lines.join("\n"));
  } else {
    console.log("No changes made");
  }
  // Write the updated content to the output file
}

function capitalize(entity: string) {
  return entity.charAt(0).toUpperCase() + entity.slice(1);
}


function isLineInCodeFence(index: number, lines: string[]): { isInCodeFence: false; } | { isInCodeFence: true, startLine: number, endLine: number; } {
  let isInCodeFence = false;
  let startLine: number | undefined = undefined;
  let endLine: number | undefined = undefined;
  lines = lines.map(l => l.split("\n")).flat();

  const matcher = /\`\`\`/g;
  // if there are an odd number of code fences before the current line, then the current line is within a code fence
  // const codeFenceCountBefore = lines.slice(0, index).filter(l => l.trim() === "```").length;
  // const codeFenceCountBefore = lines.slice(0, index).filter(l => l.match(/```/g)).length;

  // oddNumber of ``` lines above
  const codeFenceCountBefore = lines.slice(0, index).filter(l => l.match(matcher)).length;

  isInCodeFence = codeFenceCountBefore % 2 === 1;

  if (isInCodeFence) {
    startLine = lines.slice(0, index).reverse().findIndex(l => l.match(matcher)) + index;
    endLine = lines.slice(index + 1).findIndex(l => l.match(matcher)) + index + 1;
    return { isInCodeFence, startLine: startLine!, endLine: endLine! };
  } else {
    return { isInCodeFence: false };
  }
}

