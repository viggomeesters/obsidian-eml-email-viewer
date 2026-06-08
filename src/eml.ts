export const BODY_RENDER_CHAR_LIMIT = 8000;
export const RAW_RENDER_CHAR_LIMIT = 20000;

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number | null;
  disposition: string;
}

export interface EmailHeaderSummary {
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  date: string;
  messageId: string;
  inReplyTo: string;
  references: string;
}

export interface ParsedEmail {
  headers: EmailHeaderSummary;
  headerText: string;
  textBody: string;
  htmlBody: string;
  sanitizedHtml: string;
  attachments: EmailAttachment[];
  warnings: string[];
  raw: string;
  rawPreview: string;
  isRawTruncated: boolean;
  isTextTruncated: boolean;
  isHtmlTruncated: boolean;
  searchText: string;
}

interface HeaderBlock {
  fields: Map<string, string[]>;
  ordered: Array<[string, string]>;
}

interface MimePart {
  headers: HeaderBlock;
  body: string;
  children: MimePart[];
}

interface ContentType {
  value: string;
  params: Map<string, string>;
}

const SUMMARY_HEADERS = [
  "from",
  "to",
  "cc",
  "bcc",
  "subject",
  "date",
  "message-id",
  "in-reply-to",
  "references",
] as const;

export function parseEmail(raw: string): ParsedEmail {
  const warnings: string[] = [];
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const root = parsePart(normalized, warnings, 0);
  const headers = summarizeHeaders(root.headers);
  const bodyParts = flattenParts(root);
  const textPart = bodyParts.find((part) => contentTypeOf(part).value === "text/plain");
  const htmlPart = bodyParts.find((part) => contentTypeOf(part).value === "text/html");
  const textBodyRaw = textPart ? decodePartBody(textPart, warnings) : "";
  const htmlBodyRaw = htmlPart ? decodePartBody(htmlPart, warnings) : "";
  const textBody = capText(textBodyRaw, BODY_RENDER_CHAR_LIMIT);
  const htmlBody = capText(htmlBodyRaw, BODY_RENDER_CHAR_LIMIT);
  const rawPreview = capText(normalized, RAW_RENDER_CHAR_LIMIT);
  const attachments = bodyParts
    .filter(isAttachmentPart)
    .map((part) => attachmentMetadata(part, warnings));

  if (textBodyRaw.length > BODY_RENDER_CHAR_LIMIT) {
    warnings.push(`Plain text body truncated at ${BODY_RENDER_CHAR_LIMIT} characters.`);
  }
  if (htmlBodyRaw.length > BODY_RENDER_CHAR_LIMIT) {
    warnings.push(`HTML body truncated at ${BODY_RENDER_CHAR_LIMIT} characters.`);
  }
  if (normalized.length > RAW_RENDER_CHAR_LIMIT) {
    warnings.push(`Raw MIME source preview truncated at ${RAW_RENDER_CHAR_LIMIT} characters.`);
  }
  if (!textBodyRaw && !htmlBodyRaw && root.body.trim()) {
    warnings.push("No text/plain or text/html body was found; raw MIME source remains available.");
  }

  const sanitizedHtml = sanitizeEmailHtml(htmlBody);
  const headerText = root.headers.ordered
    .map(([name, value]) => `${name}: ${decodeHeaderValue(value)}`)
    .join("\n");
  const searchText = [
    headerText,
    textBodyRaw,
    htmlToText(sanitizedHtml),
    attachments.map((attachment) => attachment.filename).join("\n"),
  ].join("\n");

  return {
    headers,
    headerText,
    textBody,
    htmlBody,
    sanitizedHtml,
    attachments,
    warnings,
    raw: normalized,
    rawPreview,
    isRawTruncated: normalized.length > RAW_RENDER_CHAR_LIMIT,
    isTextTruncated: textBodyRaw.length > BODY_RENDER_CHAR_LIMIT,
    isHtmlTruncated: htmlBodyRaw.length > BODY_RENDER_CHAR_LIMIT,
    searchText,
  };
}

export function sanitizeEmailHtml(html: string): string {
  if (!html.trim()) return "";

  return html
    .replace(/<\s*(script|style|iframe|object|embed|frame|frameset|form|textarea|select|button)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|link|meta|base|iframe|object|embed|frame|frameset|form|input|button)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(style|srcset|action|poster|background)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|cite|longdesc|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (_match, name: string, value: string) => {
      const stripped = stripQuotes(value);
      if (!shouldBlockUrl(stripped)) return ` ${name}=${value}`;
      return ` data-blocked-${name.toLowerCase()}="${escapeAttribute(stripped)}"`;
    })
    .replace(/<img\b((?:(?!alt=)[^>])*)>/gi, (match: string) => {
      if (/\salt\s*=/i.test(match)) return match;
      return match.replace(/>$/, ' alt="Blocked email image">');
    });
}

export function findEmailMatches(email: ParsedEmail, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const haystack = email.searchText.toLowerCase();
  let index = haystack.indexOf(needle);
  let count = 0;
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function parsePart(raw: string, warnings: string[], depth: number): MimePart {
  if (depth > 20) {
    warnings.push("MIME nesting limit reached.");
    return { headers: emptyHeaders(), body: raw, children: [] };
  }

  const splitIndex = findHeaderBodySplit(raw);
  const headerRaw = splitIndex === -1 ? raw : raw.slice(0, splitIndex);
  const body = splitIndex === -1 ? "" : raw.slice(splitIndex).replace(/^\n\n?/, "");
  const headers = parseHeaders(headerRaw, warnings);
  const contentType = contentTypeFrom(headerValue(headers, "content-type"));
  const boundary = contentType.params.get("boundary");

  if (contentType.value.startsWith("multipart/")) {
    if (!boundary) {
      warnings.push(`Multipart message is missing a boundary for ${contentType.value}.`);
      return { headers, body, children: [] };
    }
    const children = splitMultipart(body, boundary, warnings).map((part) =>
      parsePart(part, warnings, depth + 1),
    );
    return { headers, body: "", children };
  }

  return { headers, body, children: [] };
}

function parseHeaders(raw: string, warnings: string[]): HeaderBlock {
  const fields = new Map<string, string[]>();
  const ordered: Array<[string, string]> = [];
  let current = "";

  for (const line of raw.split("\n")) {
    if (!line) continue;
    if (/^[\t ]/.test(line)) {
      current += ` ${line.trim()}`;
      continue;
    }
    if (current) appendHeader(current, fields, ordered, warnings);
    current = line;
  }
  if (current) appendHeader(current, fields, ordered, warnings);

  return {
    fields,
    ordered,
  };
}

function appendHeader(
  line: string,
  fields: Map<string, string[]>,
  ordered: Array<[string, string]>,
  warnings: string[],
): void {
  const separator = line.indexOf(":");
  if (separator === -1) {
    warnings.push(`Malformed header ignored: ${line.slice(0, 60)}`);
    return;
  }
  const name = line.slice(0, separator).trim();
  const value = line.slice(separator + 1).trim();
  const key = name.toLowerCase();
  const list = fields.get(key) ?? [];
  list.push(value);
  fields.set(key, list);
  ordered.push([name, value]);
}

function summarizeHeaders(headers: HeaderBlock): EmailHeaderSummary {
  const summary = Object.fromEntries(
    SUMMARY_HEADERS.map((header) => [camelHeader(header), decodeHeaderValue(headerValue(headers, header))]),
  ) as unknown as EmailHeaderSummary;

  return summary;
}

function camelHeader(header: string): keyof EmailHeaderSummary {
  if (header === "message-id") return "messageId";
  if (header === "in-reply-to") return "inReplyTo";
  return header.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) as keyof EmailHeaderSummary;
}

function flattenParts(part: MimePart): MimePart[] {
  if (part.children.length === 0) return [part];
  return part.children.flatMap(flattenParts);
}

function splitMultipart(body: string, boundary: string, warnings: string[]): string[] {
  const marker = `--${boundary}`;
  const closeMarker = `--${boundary}--`;
  const lines = body.split("\n");
  const parts: string[] = [];
  let current: string[] | null = null;
  let closed = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === marker) {
      if (current) parts.push(current.join("\n"));
      current = [];
      continue;
    }
    if (trimmed === closeMarker) {
      if (current) parts.push(current.join("\n"));
      current = null;
      closed = true;
      continue;
    }
    if (current) current.push(line);
  }

  if (current) {
    parts.push(current.join("\n"));
    warnings.push(`Multipart boundary "${boundary}" was not closed.`);
  }
  if (parts.length === 0) {
    warnings.push(`Multipart boundary "${boundary}" produced no parts.`);
  }
  if (!closed) {
    warnings.push(`Closing boundary "${boundary}" was not found.`);
  }

  return parts;
}

function decodePartBody(part: MimePart, warnings: string[]): string {
  const transferEncoding = headerValue(part.headers, "content-transfer-encoding").toLowerCase();
  const body = part.body.replace(/\n$/, "");

  if (transferEncoding === "base64") {
    return decodeBase64(body, warnings);
  }
  if (transferEncoding === "quoted-printable") {
    return decodeQuotedPrintable(body, warnings);
  }
  return body;
}

function decodeBase64(value: string, warnings: string[]): string {
  try {
    const binary = atob(value.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    warnings.push("A base64 MIME part could not be decoded.");
    return value;
  }
}

function decodeQuotedPrintable(value: string, warnings: string[]): string {
  try {
    const unfolded = value.replace(/=\n/g, "");
    const bytes: number[] = [];
    for (let index = 0; index < unfolded.length; index += 1) {
      const char = unfolded[index];
      if (char === "=" && /^[0-9A-Fa-f]{2}$/.test(unfolded.slice(index + 1, index + 3))) {
        bytes.push(Number.parseInt(unfolded.slice(index + 1, index + 3), 16));
        index += 2;
      } else {
        bytes.push(char.charCodeAt(0));
      }
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
  } catch {
    warnings.push("A quoted-printable MIME part could not be decoded.");
    return value;
  }
}

function attachmentMetadata(part: MimePart, warnings: string[]): EmailAttachment {
  const contentType = contentTypeOf(part);
  const disposition = contentDispositionOf(part);
  const filename =
    decodeHeaderValue(disposition.params.get("filename") ?? contentType.params.get("name") ?? "unnamed attachment");
  const decoded = decodePartBody(part, warnings);
  return {
    filename,
    contentType: contentType.value || "application/octet-stream",
    size: decoded ? new Blob([decoded]).size : null,
    disposition: disposition.value || "attachment",
  };
}

function isAttachmentPart(part: MimePart): boolean {
  const disposition = contentDispositionOf(part);
  const contentType = contentTypeOf(part);
  return (
    disposition.value === "attachment" ||
    disposition.params.has("filename") ||
    contentType.params.has("name")
  );
}

function contentTypeOf(part: MimePart): ContentType {
  return contentTypeFrom(headerValue(part.headers, "content-type"));
}

function contentTypeFrom(value: string): ContentType {
  const parsed = parseStructuredHeader(value || "text/plain");
  return {
    value: parsed.value.toLowerCase(),
    params: parsed.params,
  };
}

function contentDispositionOf(part: MimePart): ContentType {
  const parsed = parseStructuredHeader(headerValue(part.headers, "content-disposition"));
  return {
    value: parsed.value.toLowerCase(),
    params: parsed.params,
  };
}

function parseStructuredHeader(value: string): ContentType {
  const segments = splitHeaderSegments(value);
  const params = new Map<string, string>();
  const mainValue = (segments.shift() ?? "").trim();

  for (const segment of segments) {
    const separator = segment.indexOf("=");
    if (separator === -1) continue;
    const key = segment.slice(0, separator).trim().toLowerCase().replace(/\*$/, "");
    const rawValue = segment.slice(separator + 1).trim();
    params.set(key, stripQuotes(rawValue));
  }

  return { value: mainValue, params };
}

function splitHeaderSegments(value: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of value) {
    if (char === '"') quoted = !quoted;
    if (char === ";" && !quoted) {
      segments.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) segments.push(current);
  return segments;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  return trimmed;
}

function decodeHeaderValue(value: string): string {
  return value.replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_match, charset, encoding, encoded) => {
    const label = String(charset).toLowerCase();
    const bytes =
      String(encoding).toLowerCase() === "b"
        ? base64Bytes(String(encoded))
        : quotedPrintableHeaderBytes(String(encoded));
    try {
      return new TextDecoder(label, { fatal: false }).decode(Uint8Array.from(bytes));
    } catch {
      return new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
    }
  });
}

function base64Bytes(value: string): number[] {
  try {
    const binary = atob(value.replace(/\s+/g, ""));
    return Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return Array.from(value, (char) => char.charCodeAt(0));
  }
}

function quotedPrintableHeaderBytes(value: string): number[] {
  const normalized = value.replace(/_/g, " ");
  const bytes: number[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "=" && /^[0-9A-Fa-f]{2}$/.test(normalized.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  return bytes;
}

function findHeaderBodySplit(raw: string): number {
  const split = raw.indexOf("\n\n");
  return split;
}

function shouldBlockUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("#")) return false;
  return true;
}

function htmlToText(html: string): string {
  if (!html.trim()) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function capText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n\n[Preview truncated]`;
}

function emptyHeaders(): HeaderBlock {
  return {
    fields: new Map(),
    ordered: [],
  };
}

function headerValue(headers: HeaderBlock, name: string): string {
  return headers.fields.get(name.toLowerCase())?.join(", ") ?? "";
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
