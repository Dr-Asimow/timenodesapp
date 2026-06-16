import { useEffect, useReducer, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { SlashCommand } from "./SlashCommand";
import { uploadNoteImage, type PageDoc } from "../../db";
import { compressImage } from "../../image";

const TEXT_COLORS = [
  { name: "Varsayılan", v: null },
  { name: "Gri", v: "#9aa4b2" },
  { name: "Yeşil", v: "#39d353" },
  { name: "Mavi", v: "#6cb0ff" },
  { name: "Sarı", v: "#f0c000" },
  { name: "Kırmızı", v: "#ff6b6b" },
  { name: "Mor", v: "#c084fc" },
];
const HILITE_COLORS = [
  { name: "Yok", v: null },
  { name: "Yeşil", v: "rgba(57,211,83,0.25)" },
  { name: "Mavi", v: "rgba(108,176,255,0.25)" },
  { name: "Sarı", v: "rgba(240,192,0,0.28)" },
  { name: "Kırmızı", v: "rgba(255,107,107,0.25)" },
  { name: "Mor", v: "rgba(192,132,252,0.25)" },
];

// Görseli sıkıştır + yükle, sonra editöre ekle (verilen konuma ya da imlece).
async function uploadAndInsert(
  editor: Editor | null,
  userId: string,
  file: File,
  pos: number | undefined,
  onError: (msg: string) => void
) {
  if (!editor) return;
  try {
    const compressed = await compressImage(file);
    const url = await uploadNoteImage(userId, compressed);
    if (typeof pos === "number") {
      editor
        .chain()
        .focus()
        .insertContentAt(pos, { type: "image", attrs: { src: url } })
        .run();
    } else {
      editor.chain().focus().setImage({ src: url }).run();
    }
  } catch (err) {
    console.error(err);
    onError("Görsel yüklenemedi.");
  }
}

export function NoteEditor({
  content,
  onChange,
  userId,
}: {
  content: PageDoc | null;
  onChange: (doc: PageDoc) => void;
  userId: string;
}) {
  // editorProps closure'ı bir kez oluşur; güncel değerleri ref ile oku
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const showErrRef = useRef<(msg: string) => void>(() => {});
  showErrRef.current = (msg: string) => {
    setUploadErr(msg);
    window.setTimeout(() => setUploadErr(null), 4000);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        placeholder: "Yazmaya başla… blok eklemek için '/' yaz",
      }),
      SlashCommand,
    ],
    content: content && Object.keys(content).length ? content : undefined,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as PageDoc),
    editorProps: {
      // Dosyayı editöre sürükle-bırak → görselse yükle, değilse varsayılan davranış
      handleDrop(view, event, _slice, moved) {
        if (moved) return false; // blok taşıma (drag handle) → PM'e bırak
        const files = Array.from(
          (event as DragEvent).dataTransfer?.files ?? []
        ).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({
          left: (event as DragEvent).clientX,
          top: (event as DragEvent).clientY,
        });
        const pos = coords?.pos ?? view.state.selection.from;
        files.forEach((f) => {
          void uploadAndInsert(
            editorRef.current,
            userIdRef.current,
            f,
            pos,
            showErrRef.current
          );
        });
        return true;
      },
      // Panodan görsel yapıştır
      handlePaste(_view, event) {
        const files = Array.from(
          (event as ClipboardEvent).clipboardData?.files ?? []
        ).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => {
          void uploadAndInsert(
            editorRef.current,
            userIdRef.current,
            f,
            undefined,
            showErrRef.current
          );
        });
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Slash menüsündeki "Görsel" öğesi gizli dosya seçiciyi açar
  useEffect(() => {
    const open = () => fileInputRef.current?.click();
    window.addEventListener("note:pick-image", open);
    return () => window.removeEventListener("note:pick-image", open);
  }, []);

  if (!editor) return null;
  return (
    <div className="note-editor">
      <Toolbar editor={editor} onPickImage={() => fileInputRef.current?.click()} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach((f) => {
            void uploadAndInsert(
              editorRef.current,
              userIdRef.current,
              f,
              undefined,
              showErrRef.current
            );
          });
          e.target.value = "";
        }}
      />
      {uploadErr ? <div className="note-upload-err">{uploadErr}</div> : null}
      <DragHandle editor={editor}>
        <div className="note-drag-handle">⠿</div>
      </DragHandle>
      <EditorContent editor={editor} className="note-content" />
    </div>
  );
}

function Toolbar({
  editor,
  onPickImage,
}: {
  editor: Editor;
  onPickImage: () => void;
}) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const fn = () => force();
    editor.on("transaction", fn);
    editor.on("selectionUpdate", fn);
    return () => {
      editor.off("transaction", fn);
      editor.off("selectionUpdate", fn);
    };
  }, [editor]);

  const c = () => editor.chain().focus();
  const is = (n: string, a?: Record<string, unknown>) => editor.isActive(n, a);

  return (
    <div className="note-toolbar">
      <div className="nt-group">
        <Btn on={() => c().setParagraph().run()} active={is("paragraph")} label="¶" title="Metin" />
        <Btn on={() => c().toggleHeading({ level: 1 }).run()} active={is("heading", { level: 1 })} label="H1" />
        <Btn on={() => c().toggleHeading({ level: 2 }).run()} active={is("heading", { level: 2 })} label="H2" />
        <Btn on={() => c().toggleHeading({ level: 3 }).run()} active={is("heading", { level: 3 })} label="H3" />
      </div>
      <div className="nt-sep" />
      <div className="nt-group">
        <Btn on={() => c().toggleBold().run()} active={is("bold")} label="B" cls="b" />
        <Btn on={() => c().toggleItalic().run()} active={is("italic")} label="I" cls="i" />
        <Btn on={() => c().toggleUnderline().run()} active={is("underline")} label="U" cls="u" />
        <Btn on={() => c().toggleStrike().run()} active={is("strike")} label="S" cls="s" />
      </div>
      <div className="nt-sep" />
      <div className="nt-group">
        <Btn on={() => c().toggleBulletList().run()} active={is("bulletList")} label="•" title="Madde" />
        <Btn on={() => c().toggleOrderedList().run()} active={is("orderedList")} label="1." title="Numaralı" />
        <Btn on={() => c().toggleTaskList().run()} active={is("taskList")} label="☑" title="Yapılacaklar" />
        <Btn on={() => c().toggleBlockquote().run()} active={is("blockquote")} label="❝" title="Alıntı" />
        <Btn on={() => c().toggleCodeBlock().run()} active={is("codeBlock")} label="</>" title="Kod" />
        <Btn on={() => c().setHorizontalRule().run()} active={false} label="—" title="Ayırıcı" />
      </div>
      <div className="nt-sep" />
      <div className="nt-group">
        <LinkBtn editor={editor} />
        <ColorBtn
          label="A"
          title="Metin rengi"
          colors={TEXT_COLORS}
          onPick={(v) =>
            v ? c().setColor(v).run() : c().unsetColor().run()
          }
        />
        <ColorBtn
          label="▦"
          title="Vurgu rengi"
          colors={HILITE_COLORS}
          onPick={(v) =>
            v ? c().toggleHighlight({ color: v }).run() : c().unsetHighlight().run()
          }
        />
      </div>
      <div className="nt-sep" />
      <div className="nt-group">
        <Btn on={onPickImage} active={false} label="🖼️" title="Görsel ekle" />
      </div>
    </div>
  );
}

function Btn({
  on,
  active,
  label,
  title,
  cls,
}: {
  on: () => void;
  active: boolean;
  label: string;
  title?: string;
  cls?: string;
}) {
  return (
    <button
      type="button"
      className={`nt-btn ${cls ?? ""} ${active ? "on" : ""}`}
      title={title ?? label}
      onMouseDown={(e) => {
        e.preventDefault();
        on();
      }}
    >
      {label}
    </button>
  );
}

function LinkBtn({ editor }: { editor: Editor }) {
  return (
    <button
      type="button"
      className={`nt-btn ${editor.isActive("link") ? "on" : ""}`}
      title="Bağlantı"
      onMouseDown={(e) => {
        e.preventDefault();
        const prev = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Bağlantı (URL):", prev ?? "https://");
        if (url === null) return;
        if (url === "") {
          editor.chain().focus().unsetLink().run();
          return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }}
    >
      🔗
    </button>
  );
}

function ColorBtn({
  label,
  title,
  colors,
  onPick,
}: {
  label: string;
  title: string;
  colors: { name: string; v: string | null }[];
  onPick: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="nt-color-wrap">
      <button
        type="button"
        className="nt-btn"
        title={title}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        {label}
      </button>
      {open ? (
        <div className="nt-color-pop" onMouseLeave={() => setOpen(false)}>
          {colors.map((col) => (
            <button
              key={col.name}
              type="button"
              className="nt-swatch"
              title={col.name}
              style={{ background: col.v ?? "transparent" }}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(col.v);
                setOpen(false);
              }}
            >
              {col.v ? "" : "⌀"}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
