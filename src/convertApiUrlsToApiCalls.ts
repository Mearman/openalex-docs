import * as fs from "fs";
import { capitalize } from "./capitalize";
import { convertUrlToApiCallCodeFence } from "./convertUrlToApiCallCodeFence";
import { findInsertionIndex } from "./findInsertionIndex";
import { Match } from "./md2ipynb";

export function convertApiUrlsToApiCalls(
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
    "import numpy as np",
    `from openalex_api import ${[
      "Configuration", "ApiClient", "AutocompleteApi"
    ].concat(entities.map((e) => `${capitalize(e)}Api`)).join(", ")}`,
    "",
    `configuration = Configuration(host="https://api.openalex.org")`,
    `autocomplete_api = AutocompleteApi(ApiClient(configuration))`,
    entities
      .map((e) => `${e}_api = ${capitalize(e)}Api(ApiClient(configuration))`)
      .join("\n"),
    "",
    "from pandasai import SmartDataframe",
    "from pandasai.llm import OpenAI",
    "```",

    "```python",
    `# @title  { run: "auto", display-mode: "form" }`,
    `openapi_token = "" # @param {type:"string"}`,
    "```",
  ].join("\n");

  let apiCallModified = false; // Flag to track if any API call is modified or added
  let offset = 0;

  const matches: (Match | undefined)[] = lines.map(line => {
    // find any url encoded characters, e.g. \u0026 or %20
    const urlEncodedCharacters = line.match(/\\u[a-z0-9]{4}|%[a-z0-9]{2}/gi);
    if (urlEncodedCharacters) {
      // replace all url encoded characters with their decoded equivalents
      urlEncodedCharacters.forEach((encodedCharacter) => {
        const decodedCharacter = decodeURIComponent(encodedCharacter);
        line = line.replace(encodedCharacter, decodedCharacter);
      });
    }
    return line;
  }).map((line, i) => {
    return line.replace(/\\_/g, "_")
      .replace(/\\&/g, "&");
  }).map((line, i) => {
    const urls = [
      ...new Set(line.match(/https:\/\/api.openalex.org\/[a-z]+[^)\s'\](`"]+/gi)),
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

  const filteredMatches: Match[] = matches.filter(Boolean);

  if (filteredMatches.length > 0) {
    const insertions: Insertion[] = filteredMatches.map(({ urls, i }) => {
      if (urls.length > 0) {
        return urls.map(({ code }): Insertion => {
          if (!originalContent.includes(code)) {
            const codeFenceLines = code.split("\n");
            const insertion = findInsertionIndex(
              codeFenceLines,
              i,
              lines,
              // offset
            );
            apiCallModified = true;
            return insertion;
          }
        });
      }
    }).flat().filter(Boolean);

    lines = insertAtIndex(lines, insertions);

    // Add pip install code fence only if an API call has been modified or added
    if (apiCallModified && !originalContent.includes(pipCommand)) {
      lines.unshift(pipInstallCodeFence);
    }
  }
  return lines.join("\n");
}

type Document = string[];
export type Insertion = {
  index: number;
  lines: string[];
};
export type Insertions = Insertion[];

function insertAtIndex(document: Document, insertions: Insertions): Document {
  // Sort insertions by index in ascending order
  insertions.sort((a, b) => a.index - b.index);

  let offset = 0;

  insertions.forEach(insertion => {
    // Adjust index by offset to account for previously added lines
    const adjustedIndex = insertion.index + offset;

    // Insert lines at the adjusted index
    document.splice(adjustedIndex, 0, ...insertion.lines);

    // Update offset by the number of lines inserted
    offset += insertion.lines.length;
  });

  return document;
}
