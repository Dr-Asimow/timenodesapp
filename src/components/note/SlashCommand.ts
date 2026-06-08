import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";

type SlashItem = {
  title: string;
  hint?: string;
  icon: string;
  keywords: string;
  run: (editor: Editor, range: Range) => void;
};

const ITEMS: SlashItem[] = [
  {
    title: "Metin",
    hint: "Normal paragraf",
    icon: "¶",
    keywords: "text metin paragraf normal",
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    title: "Başlık 1",
    hint: "Büyük başlık",
    icon: "H1",
    keywords: "heading baslik h1 1",
    run: (e, r) =>
      e.chain().focus().deleteRange(r).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Başlık 2",
    hint: "Orta başlık",
    icon: "H2",
    keywords: "heading baslik h2 2",
    run: (e, r) =>
      e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Başlık 3",
    hint: "Küçük başlık",
    icon: "H3",
    keywords: "heading baslik h3 3",
    run: (e, r) =>
      e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Madde listesi",
    hint: "• liste",
    icon: "•",
    keywords: "bullet list madde liste",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    title: "Numaralı liste",
    hint: "1. liste",
    icon: "1.",
    keywords: "ordered numbered numarali liste",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    title: "Yapılacaklar",
    hint: "Onay kutusu",
    icon: "☑",
    keywords: "todo task checklist yapilacak onay kutu checkbox",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    title: "Alıntı",
    hint: "Quote",
    icon: "❝",
    keywords: "quote alinti",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    title: "Kod bloğu",
    hint: "Code",
    icon: "</>",
    keywords: "code kod",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    title: "Ayırıcı çizgi",
    hint: "Divider",
    icon: "—",
    keywords: "divider ayirici cizgi hr",
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
];

function makeRenderer() {
  let el: HTMLDivElement | null = null;
  let items: SlashItem[] = [];
  let selected = 0;
  let command: ((item: SlashItem) => void) | null = null;

  const paint = () => {
    if (!el) return;
    el.innerHTML = "";
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "slash-empty";
      empty.textContent = "Sonuç yok";
      el.appendChild(empty);
      return;
    }
    items.forEach((it, i) => {
      const b = document.createElement("button");
      b.className = "slash-item" + (i === selected ? " sel" : "");
      b.innerHTML =
        `<span class="slash-ic">${it.icon}</span>` +
        `<span class="slash-text"><span class="slash-title">${it.title}</span>` +
        (it.hint ? `<span class="slash-hint">${it.hint}</span>` : "") +
        `</span>`;
      b.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        selected = i;
        command?.(it);
      });
      el!.appendChild(b);
    });
  };

  const position = (rectFn?: (() => DOMRect | null) | null) => {
    if (!el || !rectFn) return;
    const r = rectFn();
    if (!r) return;
    el.style.top = `${window.scrollY + r.bottom + 6}px`;
    el.style.left = `${window.scrollX + r.left}px`;
  };

  const destroy = () => {
    el?.remove();
    el = null;
  };

  return {
    onStart: (props: any) => {
      items = props.items;
      command = props.command;
      selected = 0;
      el = document.createElement("div");
      el.className = "slash-menu";
      document.body.appendChild(el);
      paint();
      position(props.clientRect);
    },
    onUpdate: (props: any) => {
      items = props.items;
      command = props.command;
      if (selected >= items.length) selected = 0;
      paint();
      position(props.clientRect);
    },
    onKeyDown: (props: any) => {
      const e: KeyboardEvent = props.event;
      if (e.key === "ArrowDown") {
        selected = (selected + 1) % Math.max(1, items.length);
        paint();
        return true;
      }
      if (e.key === "ArrowUp") {
        selected = (selected - 1 + items.length) % Math.max(1, items.length);
        paint();
        return true;
      }
      if (e.key === "Enter") {
        const it = items[selected];
        if (it) command?.(it);
        return true;
      }
      if (e.key === "Escape") {
        destroy();
        return true;
      }
      return false;
    },
    onExit: () => destroy(),
  };
}

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return ITEMS.filter(
            (i) =>
              i.title.toLowerCase().includes(q) || i.keywords.includes(q)
          ).slice(0, 10);
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: makeRenderer,
      }),
    ];
  },
});
