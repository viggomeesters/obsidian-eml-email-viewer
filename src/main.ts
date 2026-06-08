import {
  Notice,
  Plugin,
  TFile,
  TextFileView,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";
import {
  EmailAttachment,
  ParsedEmail,
  findEmailMatches,
  parseEmail,
} from "./eml";

const VIEW_TYPE_EML_EMAIL_VIEWER = "eml-email-viewer";
const EML_EXTENSIONS = ["eml"];

type BodyMode = "text" | "html" | "raw";

export default class EmlEmailViewerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_EML_EMAIL_VIEWER,
      (leaf) => new EmlEmailViewerView(leaf),
    );
    this.registerExtensions(EML_EXTENSIONS, VIEW_TYPE_EML_EMAIL_VIEWER);

    this.addCommand({
      id: "open-current-eml-in-viewer",
      name: "Open current EML file in viewer",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!isEmlFile(file)) return false;

        if (!checking) {
          void this.openEmlFile(file);
        }
        return true;
      },
    });
  }

  async openEmlFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: VIEW_TYPE_EML_EMAIL_VIEWER,
      state: { file: file.path },
      active: true,
    });
  }
}

class EmlEmailViewerView extends TextFileView {
  private mode: BodyMode = "text";
  private query = "";

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_EML_EMAIL_VIEWER;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "EML Email Viewer";
  }

  getIcon(): string {
    return "mail";
  }

  setViewData(data: string): void {
    this.data = data;
    this.render();
  }

  getViewData(): string {
    return this.data;
  }

  clear(): void {
    this.data = "";
    this.contentEl.empty();
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("eml-email-viewer");

    const header = container.createDiv({ cls: "eml-email-viewer__header" });
    this.renderTitle(header);

    if (!this.file) {
      renderMessage(container, "No EML file is attached to this viewer.");
      return;
    }

    if (!isEmlFile(this.file)) {
      renderMessage(container, "This viewer only supports .eml files.");
      return;
    }

    if (!this.data.trim()) {
      renderMessage(container, "This EML file is empty.");
      return;
    }

    const parsed = parseEmail(this.data);
    const matchCount = findEmailMatches(parsed, this.query);
    this.renderToolbar(header, matchCount);
    renderPrivacyNotice(container);
    renderWarnings(container, parsed);
    renderSummary(container, parsed);
    this.renderBody(container, parsed);
    renderAttachments(container, parsed.attachments);
  }

  private renderTitle(parent: HTMLElement): void {
    const title = parent.createDiv({ cls: "eml-email-viewer__title" });
    title.createDiv({
      cls: "eml-email-viewer__filename",
      text: this.file?.name ?? "EML file",
    });
    title.createDiv({
      cls: "eml-email-viewer__path",
      text: this.file?.path ?? "",
    });
  }

  private renderToolbar(parent: HTMLElement, matchCount: number): void {
    const toolbar = parent.createDiv({ cls: "eml-email-viewer__toolbar" });

    const searchWrap = toolbar.createDiv({ cls: "eml-email-viewer__search" });
    setIcon(searchWrap.createSpan({ cls: "eml-email-viewer__search-icon" }), "search");
    const searchInput = searchWrap.createEl("input", {
      attr: {
        "aria-label": "Search email",
        placeholder: "Search headers, body, attachments",
        spellcheck: "false",
        type: "search",
        value: this.query,
      },
    });
    searchInput.addEventListener("input", () => {
      this.query = searchInput.value;
      this.render();
    });

    toolbar.createDiv({
      cls: "eml-email-viewer__match-count",
      text: this.query.trim() ? `${matchCount} matches` : "Search ready",
    });

    const modeGroup = toolbar.createDiv({
      cls: "eml-email-viewer__segmented",
      attr: { "aria-label": "Body view" },
    });
    const textButton = createTextButton(modeGroup, "Text");
    const htmlButton = createTextButton(modeGroup, "HTML");
    const rawButton = createTextButton(modeGroup, "Raw MIME");
    textButton.toggleClass("is-active", this.mode === "text");
    htmlButton.toggleClass("is-active", this.mode === "html");
    rawButton.toggleClass("is-active", this.mode === "raw");

    textButton.addEventListener("click", () => {
      this.mode = "text";
      this.render();
    });
    htmlButton.addEventListener("click", () => {
      this.mode = "html";
      this.render();
    });
    rawButton.addEventListener("click", () => {
      this.mode = "raw";
      this.render();
    });

    const refreshButton = createIconButton(toolbar, "refresh-cw", "Refresh file");
    refreshButton.addEventListener("click", () => {
      void this.reloadFile();
    });
  }

  private renderBody(parent: HTMLElement, parsed: ParsedEmail): void {
    const section = parent.createDiv({ cls: "eml-email-viewer__section" });
    section.createDiv({ cls: "eml-email-viewer__section-title", text: "Body" });

    if (this.mode === "text") {
      if (!parsed.textBody.trim()) {
        renderMessage(section, "No text/plain body was found.");
        return;
      }
      renderPre(section, parsed.textBody, this.query, parsed.isTextTruncated);
      return;
    }

    if (this.mode === "html") {
      if (!parsed.sanitizedHtml.trim()) {
        renderMessage(section, "No text/html body was found.");
        return;
      }
      const htmlPreview = section.createDiv({ cls: "eml-email-viewer__html-preview" });
      htmlPreview.innerHTML = parsed.sanitizedHtml;
      renderBlockedRemoteList(section, htmlPreview);
      if (parsed.isHtmlTruncated) {
        section.createDiv({
          cls: "eml-email-viewer__cap-note",
          text: "HTML preview is truncated. Use Raw MIME for full source.",
        });
      }
      return;
    }

    renderPre(section, parsed.rawPreview, this.query, parsed.isRawTruncated);
  }

  private async reloadFile(): Promise<void> {
    if (!this.file) {
      new Notice("No EML file to refresh");
      return;
    }

    try {
      this.data = await this.app.vault.read(this.file);
      this.render();
    } catch (error) {
      this.contentEl.empty();
      this.contentEl.addClass("eml-email-viewer");
      renderMessage(this.contentEl, `Unable to read EML file: ${getErrorMessage(error)}`);
    }
  }
}

function renderPrivacyNotice(parent: HTMLElement): void {
  const notice = parent.createDiv({ cls: "eml-email-viewer__privacy" });
  setIcon(notice.createSpan({ cls: "eml-email-viewer__privacy-icon" }), "shield-check");
  notice.createSpan({
    text: "Read-only local preview. Remote images, scripts, external styles, forms, mailto links, and attachment opening are blocked.",
  });
}

function renderWarnings(parent: HTMLElement, parsed: ParsedEmail): void {
  if (parsed.warnings.length === 0) return;
  const warnings = parent.createDiv({ cls: "eml-email-viewer__warnings" });
  setIcon(warnings.createSpan({ cls: "eml-email-viewer__warning-icon" }), "triangle-alert");
  const list = warnings.createEl("ul");
  for (const warning of parsed.warnings) {
    list.createEl("li", { text: warning });
  }
}

function renderSummary(parent: HTMLElement, parsed: ParsedEmail): void {
  const section = parent.createDiv({ cls: "eml-email-viewer__section eml-email-viewer__summary" });
  section.createDiv({ cls: "eml-email-viewer__section-title", text: "Headers" });
  const grid = section.createDiv({ cls: "eml-email-viewer__header-grid" });
  const rows: Array<[string, string]> = [
    ["From", parsed.headers.from],
    ["To", parsed.headers.to],
    ["Cc", parsed.headers.cc],
    ["Bcc", parsed.headers.bcc],
    ["Subject", parsed.headers.subject],
    ["Date", parsed.headers.date],
    ["Message-ID", parsed.headers.messageId],
    ["In-Reply-To", parsed.headers.inReplyTo],
    ["References", parsed.headers.references],
  ];

  for (const [label, value] of rows) {
    grid.createDiv({ cls: "eml-email-viewer__header-label", text: label });
    grid.createDiv({ cls: "eml-email-viewer__header-value", text: value || "Not present" });
  }
}

function renderAttachments(parent: HTMLElement, attachments: EmailAttachment[]): void {
  const section = parent.createDiv({ cls: "eml-email-viewer__section" });
  section.createDiv({
    cls: "eml-email-viewer__section-title",
    text: `Attachments (${attachments.length})`,
  });

  if (attachments.length === 0) {
    renderMessage(section, "No attachments were declared in this message.");
    return;
  }

  const table = section.createEl("table", { cls: "eml-email-viewer__attachments" });
  const thead = table.createEl("thead");
  const headRow = thead.createEl("tr");
  ["Filename", "Content type", "Size", "Disposition"].forEach((label) => {
    headRow.createEl("th", { text: label });
  });
  const tbody = table.createEl("tbody");
  for (const attachment of attachments) {
    const row = tbody.createEl("tr");
    row.createEl("td", { text: attachment.filename });
    row.createEl("td", { text: attachment.contentType });
    row.createEl("td", { text: attachment.size === null ? "Unknown" : formatBytes(attachment.size) });
    row.createEl("td", { text: attachment.disposition });
  }
}

function renderBlockedRemoteList(parent: HTMLElement, htmlPreview: HTMLElement): void {
  const blocked = Array.from(htmlPreview.querySelectorAll("*")).flatMap((element) =>
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith("data-blocked-"))
      .map((attribute) => `${attribute.name.replace("data-blocked-", "")}: ${attribute.value}`),
  );

  if (blocked.length === 0) return;

  const note = parent.createDiv({ cls: "eml-email-viewer__blocked" });
  setIcon(note.createSpan({ cls: "eml-email-viewer__blocked-icon" }), "ban");
  note.createSpan({ text: `${blocked.length} remote or active URL attributes blocked.` });
}

function renderPre(parent: HTMLElement, text: string, query: string, truncated: boolean): void {
  const body = parent.createDiv({ cls: "eml-email-viewer__pre-wrap" });
  const pre = body.createEl("pre", { cls: "eml-email-viewer__pre" });
  renderHighlightedText(pre, text, query);
  if (truncated) {
    parent.createDiv({
      cls: "eml-email-viewer__cap-note",
      text: "Preview is truncated to keep large emails responsive.",
    });
  }
}

function renderHighlightedText(parent: HTMLElement, text: string, query: string): void {
  const needle = query.trim();
  if (!needle) {
    parent.appendText(text);
    return;
  }

  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let cursor = 0;
  let index = lowerText.indexOf(lowerNeedle);

  while (index !== -1) {
    if (index > cursor) parent.appendText(text.slice(cursor, index));
    parent.createSpan({
      cls: "eml-email-viewer__highlight",
      text: text.slice(index, index + needle.length),
    });
    cursor = index + needle.length;
    index = lowerText.indexOf(lowerNeedle, cursor);
  }

  if (cursor < text.length) parent.appendText(text.slice(cursor));
}

function renderMessage(parent: HTMLElement, message: string): void {
  parent.createDiv({ cls: "eml-email-viewer__message", text: message });
}

function createTextButton(parent: HTMLElement, label: string): HTMLButtonElement {
  return parent.createEl("button", {
    cls: "eml-email-viewer__button",
    text: label,
    attr: { type: "button" },
  });
}

function createIconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "eml-email-viewer__icon-button",
    attr: {
      "aria-label": label,
      title: label,
      type: "button",
    },
  });
  setIcon(button, icon);
  return button;
}

function isEmlFile(file: TFile | null): file is TFile {
  return file?.extension.toLowerCase() === "eml";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
