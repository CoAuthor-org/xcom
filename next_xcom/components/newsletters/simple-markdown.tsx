"use client";

import * as React from "react";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-t-${i++}`}>{text.slice(last, m.index)}</React.Fragment>
      );
    }
    nodes.push(
      <a
        key={`${keyPrefix}-a-${i++}`}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#1d4ed8] underline break-all"
      >
        {m[1]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    nodes.push(
      <React.Fragment key={`${keyPrefix}-t-${i++}`}>{text.slice(last)}</React.Fragment>
    );
  }
  return nodes.length ? nodes : [text];
}

export function SimpleMarkdown({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let bi = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${bi++}`} className="list-disc pl-5 space-y-1 my-2">
        {listItems.map((line, j) => (
          <li key={j} className="text-[#2d2d2d]">
            {renderInline(line.replace(/^[-*]\s+/, ""), `li-${j}`)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^[-*]\s+/.test(line)) {
      listItems.push(line);
      continue;
    }
    flushList();
    if (!line.trim()) {
      blocks.push(<div key={`br-${bi++}`} className="h-2" />);
      continue;
    }
    blocks.push(
      <p key={`p-${bi++}`} className="text-[#2d2d2d] my-1 leading-relaxed">
        {renderInline(line, `p-${bi}`)}
      </p>
    );
  }
  flushList();

  return <div className="text-sm sm:text-base">{blocks}</div>;
}

export function stripMarkdownForTts(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
