import { file, write } from "bun";

const JSON_VERSION_PATTERN = /"version": "[^"]+"/;
const CARGO_VERSION_PATTERN = /^version = "[^"]+"/m;

const version = process.argv[2];

if (!version) {
  throw new Error("usage: bun run version <version>");
}

await setVersion(
  "package.json",
  JSON_VERSION_PATTERN,
  `"version": "${version}"`
);
await setVersion(
  "src-tauri/tauri.conf.json",
  JSON_VERSION_PATTERN,
  `"version": "${version}"`
);
await setVersion(
  "src-tauri/Cargo.toml",
  CARGO_VERSION_PATTERN,
  `version = "${version}"`
);

async function setVersion(path: string, pattern: RegExp, replacement: string) {
  const source = await file(path).text();

  if (!pattern.test(source)) {
    throw new Error(`No version field found in ${path}`);
  }

  await write(path, source.replace(pattern, replacement));
}
