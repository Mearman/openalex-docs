#!/usr/bin/env npx -y tsx
import * as fs from "fs";
import * as path from "path";
import { convertApiUrlsToApiCalls } from "./convertApiUrlsToApiCalls";
import { convertMarkdownToJupyterNotebook } from "./convertMarkdownToJupyterNotebook";
import { makeLinksRelative } from "./makeLinksRelative";
import { recursivelyProcessFilesInDir } from "./recursivelyProcessFilesInDir";
import { removeYamlHeaders } from "./removeYamlHeaders";
import { updateMdLinksToIpynb } from "./updateMdLinksToIpynb";
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

export type NotebookCell = CodeCell | MarkdownCell;

// Define the structure of a Jupyter Notebook
export interface JupyterNotebook {
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

const repo_root = (() => {
  // ascend to root of repo
  let dir = __dirname;
  while (!fs.existsSync(`${dir}/.git`)) {
    dir = path.resolve(dir, "..");
  }
  return dir;
})()

export function main() {
  recursivelyProcessFilesInDir(
    ".",
    /^(?!.*node_modules).*\.md$/,
    (filepath: fs.PathLike, content: string) => {
      const markdownWithoutHeaders = removeYamlHeaders(content);
      const markdownWithApiCalls = convertApiUrlsToApiCalls(
        markdownWithoutHeaders,
        path.relative(repo_root, filepath.toString())
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

export type Match = {
  line: string;
  urls: { url: string[]; code: string; }[];
  i: number;
};

// type FileExistenceChecker = (path: string) => boolean;
export type FileExistenceChecker = typeof fs.existsSync;


