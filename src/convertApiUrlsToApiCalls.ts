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
