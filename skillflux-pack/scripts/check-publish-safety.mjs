// Publish safety gate: guarantees the public npm tarball never ships paid
// (non-free) skill payloads. Paid content must be served only from the
// authorized registry API — never bundled into the installer package.
//
// Runs in `prepublishOnly`. Fails the publish if package.json "files" would
// include any skill whose tier is not "free".

import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function fail(message) {
  console.error(`\n✗ Publish safety check failed:\n  ${message}\n`);
  process.exit(1);
}

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const pack = JSON.parse(await readFile(join(root, "pack.json"), "utf8"));

const files = Array.isArray(pkg.files) ? pkg.files : [];
const normalized = files.map((f) => f.replace(/^\.\//, "").replace(/\/+$/, ""));

// Broad patterns would sweep the whole skills/ tree (including paid payloads)
// into the tarball. Force maintainers to enumerate individual free skill dirs.
const broad = normalized.filter((f) =>
  ["", ".", "*", "**", "skills", "skills/*", "skills/**"].includes(f),
);
if (broad.length > 0) {
  fail(
    `package.json "files" contains broad pattern(s) that would publish the entire ` +
      `skills/ tree including paid payloads: ${broad.join(", ")}. ` +
      `List individual free skill directories instead (e.g. "skills/demo-skill").`,
  );
}

// A skill id is "published" when an explicit files entry targets its directory.
function isPublished(skillId) {
  return normalized.some(
    (f) => f === `skills/${skillId}` || f.startsWith(`skills/${skillId}/`),
  );
}

const leaked = [];
const bundledFree = [];
const paidSkills = [];

for (const skill of pack.skills) {
  if (skill.tier !== "free") paidSkills.push(skill.id);
  const published = isPublished(skill.id);
  if (skill.tier !== "free" && published) leaked.push(skill.id);
  if (skill.tier === "free" && published) bundledFree.push(skill.id);
}

if (leaked.length > 0) {
  fail(
    `Paid (non-free) skill payload(s) would be shipped in the public npm package: ` +
      `${leaked.join(", ")}. Remove them from package.json "files". ` +
      `Paid content must be downloaded from the registry after entitlement checks.`,
  );
}

// With a "files" allowlist present, .npmignore can only further restrict the
// tarball, so it cannot re-introduce paid content. Warn if one exists anyway.
try {
  await access(join(root, ".npmignore"));
  console.warn(
    "  note: a .npmignore exists; the \"files\" allowlist still governs inclusion.",
  );
} catch {
  // no .npmignore — expected
}

console.log(
  `✓ Publish safety OK.\n` +
    `  Bundled free skills: ${bundledFree.join(", ") || "(none)"}\n` +
    `  Paid skills kept out of the tarball: ${paidSkills.join(", ") || "(none)"}`,
);
