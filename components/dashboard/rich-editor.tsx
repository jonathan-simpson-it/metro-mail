"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Eraser,
  LineSegment,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Quotes,
  TextB,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from "@phosphor-icons/react";

export interface RichEditorHandle {
  getHTML(): string;
  setContent(html: string): void;
  insertHtml(html: string): void;
  focus(): void;
}

interface RichEditorProps {
  initialHtml?: string;
  onChange?: (html: string) => void;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  triggerRef,
  ariaExpanded,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
  ariaExpanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="tool-btn"
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-expanded={ariaExpanded}
      data-active={active}
      disabled={disabled}
      onClick={onClick}
      ref={triggerRef}
    >
      {children}
    </button>
  );
}

const TOOLBAR_IDLE = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  link: false,
  bullet: false,
  ordered: false,
  quote: false,
  h2: false,
} as const;

/**
 * Inline atom node for unreplaced template tokens ({{Company}}). Renders as
 * a highlighted chip that is selected/deleted as a single unit, and survives
 * copy/paste and mode switches via its data-token attribute. Plain text
 * {{…}} inside the editor (typed manually) still trips the send-time token
 * guard, so nothing ships raw.
 */
const TemplateToken = Node.create({
  name: "templateToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      token: {
        default: "",
        parseHTML: (element) =>
          (element as HTMLElement).getAttribute("data-token") ?? "",
        renderHTML: (attributes) => ({
          "data-token": attributes.token as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-token]" }];
  },

  renderHTML({ node }) {
    return [
      "span",
      { "data-token": node.attrs.token as string, class: "tpl-token" },
      `{{${node.attrs.token as string}}}`,
    ];
  },
});

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor({ initialHtml = "", onChange }, ref) {
    const [mode, setMode] = useState<"wysiwyg" | "html">("wysiwyg");
    const [html, setHtml] = useState(initialHtml);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [htmlParseError, setHtmlParseError] = useState(false);
    const selectionRef = useRef<{ from: number; to: number } | null>(null);
    const linkTriggerRef = useRef<HTMLButtonElement>(null);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    });

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          link: {
            openOnClick: false,
            autolink: true,
            defaultProtocol: "https",
          },
          underline: {},
        }),
        TemplateToken,
        Placeholder.configure({ placeholder: "Write your message…" }),
      ],
      content: initialHtml,
      immediatelyRender: false,
      onUpdate: ({ editor: e }) => {
        const next = e.getHTML();
        setHtml(next);
        onChangeRef.current?.(next);
      },
    });

    const state = useEditorState({
      editor,
      selector: ({ editor: e }) => ({
        bold: e?.isActive("bold") ?? false,
        italic: e?.isActive("italic") ?? false,
        underline: e?.isActive("underline") ?? false,
        strike: e?.isActive("strike") ?? false,
        link: e?.isActive("link") ?? false,
        bullet: e?.isActive("bulletList") ?? false,
        ordered: e?.isActive("orderedList") ?? false,
        quote: e?.isActive("blockquote") ?? false,
        h2: e?.isActive("heading", { level: 2 }) ?? false,
      }),
    }) ?? TOOLBAR_IDLE;

    useImperativeHandle(
      ref,
      () => ({
        getHTML: () => (mode === "html" ? html : (editor?.getHTML() ?? html)),
        setContent: (content: string) => {
          setHtml(content);
          editor?.commands.setContent(content, { emitUpdate: false });
        },
        insertHtml: (content: string) => {
          if (mode === "html") {
            try {
              editor?.commands.setContent(html, {
                emitUpdate: false,
                errorOnInvalidContent: true,
              });
              setMode("wysiwyg");
            } catch {
              return;
            }
          }
          editor?.chain().focus().insertContent(content).run();
        },
        focus: () => editor?.commands.focus(),
      }),
      [editor, html, mode],
    );

    function exec(fn: (e: Editor) => void) {
      if (!editor) return;
      fn(editor);
    }

    function switchMode(next: "wysiwyg" | "html") {
      if (next === mode || !editor) return;
      if (next === "wysiwyg") {
        try {
          editor.commands.setContent(html, {
            emitUpdate: false,
            errorOnInvalidContent: true,
          });
          setHtmlParseError(false);
        } catch {
          setHtmlParseError(true);
          return;
        }
      }
      setMode(next);
    }

    function closeLinkPopover() {
      selectionRef.current = null;
      setLinkOpen(false);
      linkTriggerRef.current?.focus();
    }

    function openLinkPopover() {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const href = (editor.getAttributes("link").href as string | undefined) ?? "";
      selectionRef.current = { from, to };
      setLinkUrl(href);
      setLinkOpen(true);
    }

    function applyLink() {
      if (!editor) return;
      const value = linkUrl.trim();
      if (value) {
        let chain = editor.chain().focus();
        if (selectionRef.current) {
          chain = chain.setTextSelection(selectionRef.current);
        }
        chain.extendMarkRange("link").setLink({ href: value }).run();
      }
      closeLinkPopover();
    }

    function removeLink() {
      if (!editor) return;
      let chain = editor.chain().focus();
      if (selectionRef.current) {
        chain = chain.setTextSelection(selectionRef.current);
      }
      chain.extendMarkRange("link").unsetLink().run();
      closeLinkPopover();
    }

    const toolDisabled = mode === "html";

    return (
      <div className="editor-body">
        <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-line pb-3">
          <ToolButton
            label="Bold"
            active={state.bold}
            disabled={toolDisabled}
            onClick={() => exec((e) => e.chain().focus().toggleBold().run())}
          >
            <TextB size={15} />
          </ToolButton>
          <ToolButton
            label="Italic"
            active={state.italic}
            disabled={toolDisabled}
            onClick={() => exec((e) => e.chain().focus().toggleItalic().run())}
          >
            <TextItalic size={15} />
          </ToolButton>
          <ToolButton
            label="Underline"
            active={state.underline}
            disabled={toolDisabled}
            onClick={() => exec((e) => e.chain().focus().toggleUnderline().run())}
          >
            <TextUnderline size={15} />
          </ToolButton>
          <ToolButton
            label="Strikethrough"
            active={state.strike}
            disabled={toolDisabled}
            onClick={() => exec((e) => e.chain().focus().toggleStrike().run())}
          >
            <TextStrikethrough size={15} />
          </ToolButton>

          <span className="tool-divider mx-1" />

          <span className="relative">
            <ToolButton
              label="Insert link"
              active={state.link}
              disabled={toolDisabled}
              onClick={openLinkPopover}
              triggerRef={linkTriggerRef}
              ariaExpanded={linkOpen}
            >
              <LinkSimple size={15} />
            </ToolButton>
            {linkOpen ? (
              <div
                className="popover right-0 top-full mt-2 w-72 p-3"
                data-open="true"
                role="dialog"
                aria-label="Insert link"
              >
                <label className="field-label" htmlFor="link-url">
                  Link URL
                </label>
                <input
                  id="link-url"
                  className="input !rounded-md !py-2 text-sm"
                  placeholder="https://…"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLink();
                    if (e.key === "Escape") closeLinkPopover();
                  }}
                  autoFocus
                  spellCheck={false}
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  {state.link ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--small !rounded-md"
                      onClick={removeLink}
                    >
                      Remove
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn--solid btn--small !rounded-md"
                    onClick={applyLink}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </span>
          <ToolButton
            label="Heading 2"
            active={state.h2}
            disabled={toolDisabled}
            onClick={() =>
              exec((e) => e.chain().focus().toggleHeading({ level: 2 }).run())
            }
          >
            <TextHTwo size={15} />
          </ToolButton>

          <span className="tool-divider mx-1" />

          <ToolButton
            label="Bullet list"
            active={state.bullet}
            disabled={toolDisabled}
            onClick={() => exec((e) => e.chain().focus().toggleBulletList().run())}
          >
            <ListBullets size={15} />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            active={state.ordered}
            disabled={toolDisabled}
            onClick={() => exec((e) => e.chain().focus().toggleOrderedList().run())}
          >
            <ListNumbers size={15} />
          </ToolButton>
          <ToolButton
            label="Quote"
            active={state.quote}
            disabled={toolDisabled}
            onClick={() => exec((e) => e.chain().focus().toggleBlockquote().run())}
          >
            <Quotes size={15} />
          </ToolButton>

          <span className="tool-divider mx-1" />

          <ToolButton
            label="Horizontal rule"
            disabled={toolDisabled}
            onClick={() => exec((e) => e.chain().focus().setHorizontalRule().run())}
          >
            <LineSegment size={15} />
          </ToolButton>
          <ToolButton
            label="Clear formatting"
            disabled={toolDisabled}
            onClick={() =>
              exec((e) => e.chain().focus().clearNodes().unsetAllMarks().run())
            }
          >
            <Eraser size={15} />
          </ToolButton>

          <div className="ml-auto flex items-center">
            <div className="seg" role="group" aria-label="Editor mode">
              <span
                className="seg__pill"
                data-pos={mode === "html" ? 1 : 0}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => switchMode("wysiwyg")}
                data-on={mode === "wysiwyg"}
                aria-pressed={mode === "wysiwyg"}
              >
                WYSIWYG
              </button>
              <button
                type="button"
                onClick={() => switchMode("html")}
                data-on={mode === "html"}
                aria-pressed={mode === "html"}
              >
                HTML
              </button>
            </div>
          </div>
        </div>

        {mode === "wysiwyg" ? (
          <EditorContent editor={editor} />
        ) : (
          <textarea
            className="editor-html"
            aria-label="HTML source"
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              setHtmlParseError(false);
              onChangeRef.current?.(e.target.value);
            }}
            placeholder="<p>Raw HTML body…</p>"
            spellCheck={false}
          />
        )}
        {htmlParseError ? (
          <p className="mt-2 text-xs text-ink" role="alert">
            This HTML could not be parsed back into the editor. Fix the markup
            in HTML mode, or switch back without changing it.
          </p>
        ) : null}
      </div>
    );
  },
);
