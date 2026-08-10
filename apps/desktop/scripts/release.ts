import { $, file, write } from "bun";

const REPO = "damien-schneider/agent-skills-library";
const TARGET = "universal-apple-darwin";
const SIGNING_IDENTITY =
  "Developer ID Application: Damien Schneider (L6N962KCN4)";
const NOTARIZATION_VARS = ["APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"];
const KEY_PATH = `${process.env.HOME}/.tauri/agents-library.key`;
const BUNDLE_DIR = `src-tauri/target/${TARGET}/release/bundle`;
const STAGING_DIR = `src-tauri/target/${TARGET}/release/publish`;
const ASSET_PREFIX = "agents-library";

const { productName, version } = await file("src-tauri/tauri.conf.json").json();
const missingVars = NOTARIZATION_VARS.filter((name) => !process.env[name]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing ${missingVars.join(", ")} — add them to apps/desktop/.env`
  );
}

if (!(await file(KEY_PATH).exists())) {
  throw new Error(`Missing updater signing key at ${KEY_PATH}`);
}

if (await hasUncommittedChanges()) {
  throw new Error(
    `apps/desktop has uncommitted changes — commit before releasing so v${version} tags the code it ships`
  );
}

if (await releaseExists(version)) {
  throw new Error(`Release v${version} already exists on ${REPO}`);
}

const commit = (await $`git rev-parse HEAD`.text()).trim();

await $`./node_modules/.bin/tauri build --target ${TARGET}`.env({
  ...process.env,
  APPLE_SIGNING_IDENTITY: SIGNING_IDENTITY,
  TAURI_SIGNING_PRIVATE_KEY: await file(KEY_PATH).text(),
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
});

const tarball = `${BUNDLE_DIR}/macos/${productName}.app.tar.gz`;
const dmg = `${BUNDLE_DIR}/dmg/${productName}_${version}_universal.dmg`;
const tarballAsset = `${ASSET_PREFIX}.app.tar.gz`;
const dmgAsset = `${ASSET_PREFIX}_${version}_universal.dmg`;

await $`mkdir -p ${STAGING_DIR}`;
await $`cp ${tarball} ${STAGING_DIR}/${tarballAsset}`;
await $`cp ${dmg} ${STAGING_DIR}/${dmgAsset}`;

const platform = {
  signature: await file(`${tarball}.sig`).text(),
  url: `https://github.com/${REPO}/releases/download/v${version}/${tarballAsset}`,
};

await write(
  `${STAGING_DIR}/latest.json`,
  `${JSON.stringify(
    {
      version,
      pub_date: new Date().toISOString(),
      platforms: { "darwin-aarch64": platform, "darwin-x86_64": platform },
    },
    null,
    2
  )}\n`
);

await $`gh release create v${version} --repo ${REPO} --target ${commit} --title ${version} --generate-notes ${STAGING_DIR}/${dmgAsset} ${STAGING_DIR}/${tarballAsset} ${STAGING_DIR}/latest.json`;

async function hasUncommittedChanges() {
  const status = await $`git status --porcelain .`.text();

  return status.trim().length > 0;
}

async function releaseExists(tag: string) {
  const probe = await $`gh release view v${tag} --repo ${REPO}`
    .quiet()
    .nothrow();

  return probe.exitCode === 0;
}
