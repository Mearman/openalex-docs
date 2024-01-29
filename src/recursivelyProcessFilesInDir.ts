import * as fs from "fs";
import * as path from "path";

export function recursivelyProcessFilesInDir(
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
    } else if (stat.isFile() && path.match(match)) {
      // const output = `${path.replace(/(\.[a-z0-9]+)+$/i, "")}${outputFilename}`;
      const content = fs.readFileSync(path, "utf-8");
      fn(path, content);
    }
  }
}
