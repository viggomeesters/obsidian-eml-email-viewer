import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const releasePackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const releaseVersions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
const main = fs.readFileSync("src/main.ts", "utf8");
const parser = fs.readFileSync("src/eml.ts", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const security = fs.readFileSync("SECURITY.md", "utf8");
const fixtures = fs.readdirSync("test-fixtures").filter((name) => name.endsWith(".eml"));
const scanned = `${main}\n${parser}\n${styles}`;

assert.equal(manifest.id, "eml-email-viewer");
assert.equal(manifest.name, "EML Email Viewer");
assert.equal(manifest.version, releasePackage.version);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(releaseVersions[manifest.version], manifest.minAppVersion);
assert.ok(!/obsidian/i.test(manifest.description));
assert.ok(main.includes('const EML_EXTENSIONS = ["eml"]'));
assert.ok(main.includes("TextFileView"));
assert.ok(main.includes("renderPrivacyNotice"));
assert.ok(main.includes("renderAttachments"));
assert.ok(main.includes("Raw MIME"));
assert.ok(parser.includes("sanitizeEmailHtml"));
assert.ok(parser.includes("BODY_RENDER_CHAR_LIMIT"));
assert.ok(parser.includes("RAW_RENDER_CHAR_LIMIT"));
assert.ok(readme.includes("Email Reader"));
assert.ok(readme.includes("file-open viewer"));
assert.ok(security.includes("remote"));
assert.ok(fixtures.includes("plain.eml"));
assert.ok(fixtures.includes("html-remote.eml"));
assert.ok(fixtures.includes("multipart-alternative.eml"));
assert.ok(fixtures.includes("attachments.eml"));
assert.ok(fixtures.includes("encoded-headers.eml"));
assert.ok(fixtures.includes("malformed.eml"));
assert.ok(fixtures.includes("large.eml"));

const forbidden = [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /navigator\.clipboard/,
  /child_process/,
  /spawn\s*\(/,
  /exec\s*\(/,
  /write\s*\(/,
  /modify\s*\(/,
  /eval\s*\(/,
  /new Function/,
  /innerHTML/,
  /outerHTML/,
  /insertAdjacentHTML/,
  /!important/,
];

for (const pattern of forbidden) {
  assert.equal(pattern.test(scanned), false, `forbidden pattern present: ${pattern}`);
}

console.log("EML Email Viewer smoke checks passed.");
