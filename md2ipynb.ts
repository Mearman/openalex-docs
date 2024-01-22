#!/usr/bin/env npx -y tsx
import * as fs from "fs";

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
		(path: fs.PathLike, content: string) => {
			const markdownWithoutHeaders = removeYamlHeaders(content);
			const markdownWithApiCalls = convertApiUrlsToApiCalls(markdownWithoutHeaders, path);
			const contentHasUpdated: boolean = content !== markdownWithApiCalls;
			const markdownWithRelativeLinks = makeLinksRelative(markdownWithApiCalls);
			const notebook = convertMarkdownToJupyterNotebook(markdownWithRelativeLinks);

			const output = path
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
		"print(json.dumps(response.to_dict(), indent=2))",
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
	let ipynbFilename = filename
		.toString()
		.replace(/(\.[a-z0-9]+)+$/i, ".ipynb")
		.replace(/^\.\//, "");

	const colabLink = `[![Open All Collab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/${owner}/${repo}/blob/${branch}/${ipynbFilename})`;
	const pipInstallCodeFence = [
		colabLink,
		"```python",
		pipCommand,
		"```",
		"```python",
		"import json",
		"from openalex_api import Configuration, ApiClient," +
		entities.map((e) => `${capitalize(e)}Api`).join(", "),
		"",
		`configuration = Configuration(host="https://api.openalex.org")`,
		entities
			.map((e) => `${e}_api = ${capitalize(e)}Api(ApiClient(configuration))`)
			.join("\n"),
		"```",
	].join("\n");

	let apiCallModified = false; // Flag to track if any API call is modified or added

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
		let offset = 0;
		filteredMatches.forEach(({ urls, i }) => {
			if (urls.length > 0) {
				const codeFences = urls.map(({ code }) => code);
				codeFences.forEach((codeFence) => {
					if (!originalContent.includes(codeFence)) {
						const insertionIndex = findInsertionIndex(i, lines, offset);
						lines.splice(insertionIndex, 0, ...codeFence.split("\n"));
						offset += codeFence.split("\n").length;
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
	currentIndex: number,
	lines: string[],
	linesAddedSoFar: number
) {
	let inCodeFence = false;
	let codeFenceEndIndex = currentIndex;

	// Check if the current line is a Markdown line break
	const isMarkdownLineBreak = lines[currentIndex].trim().endsWith("\\");

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

function makeLinksRelative(conctent: string): string {
	const lines = conctent.split("\n");
	const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

	return lines.map(line => {
		return line.replace(linkRegex, (match, text, url) => {
			// Check if the link is a document link (not starting with http:// or https://)
			if (!/^https?:\/\//.test(url)) {
				// Prepend "./" if it's not there
				if (!url.startsWith("./")) {
					url = "./" + url;
				}

				// Append "README.md" if the link ends with "/"
				if (url.endsWith("/")) {
					url += "README.md";
				}
			}

			// Return the modified link
			return `[${text}](${url})`;
		});
	}).join("\n");
}
