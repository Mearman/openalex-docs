import { JupyterNotebook, NotebookCell } from "./md2ipynb";

// Function to convert Markdown to a Jupyter Notebook
export function convertMarkdownToJupyterNotebook(
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
        return !removeCells.some((regex) => cell.source.join("\n").match(regex)
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
      source: cell.source.map((line, i) => i === cell.source.length - 1 ? line : line + "\n"
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
