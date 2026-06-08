import assert from "node:assert/strict";
import fs from "node:fs";
import esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/eml.ts"],
  format: "esm",
  outfile: ".tmp-eml-test.mjs",
  platform: "node",
  target: "node20",
});

const {
  BODY_RENDER_CHAR_LIMIT,
  RAW_RENDER_CHAR_LIMIT,
  findEmailMatches,
  parseEmail,
  sanitizeEmailHtml,
} = await import(new URL("../.tmp-eml-test.mjs", import.meta.url));

function readFixture(name) {
  return fs.readFileSync(new URL(`../test-fixtures/${name}`, import.meta.url), "utf8");
}

const plain = parseEmail(readFixture("plain.eml"));
assert.equal(plain.headers.from, "Alice Example <alice@example.com>");
assert.equal(plain.headers.to, "Bob Example <bob@example.com>");
assert.equal(plain.headers.subject, "Plain fixture");
assert.ok(plain.textBody.includes("plain text email fixture"));
assert.equal(plain.attachments.length, 0);
assert.equal(findEmailMatches(plain, "alice"), 3);

const html = parseEmail(readFixture("html-remote.eml"));
assert.equal(html.headers.subject, "HTML remote content fixture");
assert.ok(html.sanitizedHtml.includes("Invoice ready"));
assert.ok(!html.sanitizedHtml.includes("<script"));
assert.ok(!html.sanitizedHtml.includes("<style"));
assert.ok(!html.sanitizedHtml.includes("<link"));
assert.ok(!html.sanitizedHtml.includes("onload"));
assert.ok(!/<img[^>]+\ssrc=/i.test(html.sanitizedHtml));
assert.ok(html.sanitizedHtml.includes("data-blocked-src"));
assert.ok(html.sanitizedHtml.includes("data-blocked-href"));

const sanitized = sanitizeEmailHtml('<p onclick="x()"><img src="https://example.com/pixel.gif"></p>');
assert.ok(!sanitized.includes("onclick"));
assert.ok(!/<img[^>]+\ssrc=/i.test(sanitized));
assert.ok(sanitized.includes("data-blocked-src"));

const multipart = parseEmail(readFixture("multipart-alternative.eml"));
assert.ok(multipart.textBody.includes("café"));
assert.ok(multipart.sanitizedHtml.includes("café"));

const attachments = parseEmail(readFixture("attachments.eml"));
assert.equal(attachments.attachments.length, 2);
assert.equal(attachments.attachments[0].filename, "report.txt");
assert.equal(attachments.attachments[0].contentType, "text/plain");
assert.equal(attachments.attachments[0].disposition, "attachment");
assert.ok((attachments.attachments[0].size ?? 0) > 0);
assert.equal(attachments.attachments[1].filename, "invoice.pdf");

const encoded = parseEmail(readFixture("encoded-headers.eml"));
assert.equal(encoded.headers.from, "José Example <jose@example.com>");
assert.equal(encoded.headers.subject, "Encoded header café");
assert.equal(encoded.headers.inReplyTo, "<previous@example.com>");
assert.ok(encoded.headers.references.includes("<root@example.com>"));

const malformed = parseEmail(readFixture("malformed.eml"));
assert.ok(malformed.textBody.includes("never closes"));
assert.ok(malformed.rawPreview.includes("missing-close"));
assert.ok(malformed.warnings.some((warning) => warning.includes("not closed")));
assert.ok(malformed.warnings.some((warning) => warning.includes("Closing boundary")));

const large = parseEmail(readFixture("large.eml"));
assert.ok(large.textBody.length <= BODY_RENDER_CHAR_LIMIT + "\n\n[Preview truncated]".length);
assert.equal(large.isTextTruncated, true);
assert.equal(large.isRawTruncated, false);

const veryLargeRaw = `${readFixture("large.eml")}\n${"x".repeat(RAW_RENDER_CHAR_LIMIT + 20)}`;
const rawCapped = parseEmail(veryLargeRaw);
assert.equal(rawCapped.isRawTruncated, true);
assert.ok(rawCapped.rawPreview.endsWith("[Preview truncated]"));

fs.rmSync(new URL("../.tmp-eml-test.mjs", import.meta.url));
console.log("EML parser fixture tests passed.");
