import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import source from "../legal/cgu.fr.md?raw";

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flush = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of markdown.replaceAll("\r\n", "\n").split("\n")) {
    const line = raw.trimEnd();
    const text = line.trim();
    if (!text) {
      flush();
      continue;
    }
    if (text.startsWith("# ")) {
      flush();
      blocks.push({ type: "h1", text: text.slice(2) });
      continue;
    }
    if (text.startsWith("## ")) {
      flush();
      blocks.push({ type: "h2", text: text.slice(3) });
      continue;
    }
    if (text.startsWith("### ")) {
      flush();
      blocks.push({ type: "h3", text: text.slice(4) });
      continue;
    }
    const unordered = text.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      if (list?.type !== "ul") {
        flush();
        list = { type: "ul", items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }
    const ordered = text.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (list?.type !== "ol") {
        flush();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    flush();
    blocks.push({ type: "p", text });
  }
  flush();
  return blocks;
}

function renderBlock(block: Block, index: number): ReactNode {
  if (block.type === "h1") return <h1 key={index}>{block.text}</h1>;
  if (block.type === "h2") return <h2 key={index}>{block.text}</h2>;
  if (block.type === "h3") return <h3 key={index}>{block.text}</h3>;
  if (block.type === "p") return <p key={index}>{block.text}</p>;
  if (block.type === "ul") {
    return (
      <ul key={index}>
        {block.items.map((item, i) => (
          <li key={`${index}-${i}`}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <ol key={index}>
      {block.items.map((item, i) => (
        <li key={`${index}-${i}`}>{item}</li>
      ))}
    </ol>
  );
}

export function TermsPage() {
  const { t, i18n } = useTranslation();
  const blocks = parseMarkdown(source);

  useEffect(() => {
    document.title = t("auth.termsTitle");
    return () => {
      document.title = "Tombola du club";
    };
  }, [t]);

  return (
    <section className="section terms-page" style={{ borderBottom: 0 }}>
      {i18n.language.startsWith("en") ? <p className="terms-official">{t("terms.officialNote")}</p> : null}
      <div className="terms-copy">{blocks.map(renderBlock)}</div>
    </section>
  );
}
