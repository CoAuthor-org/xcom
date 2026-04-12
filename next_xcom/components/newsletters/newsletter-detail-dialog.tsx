"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { SimpleMarkdown } from "./simple-markdown";
import type { NewsletterEmailRow } from "@/lib/newsletters/types";

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NewsletterDetailDialog({
  row,
  open,
  onOpenChange,
}: {
  row: NewsletterEmailRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const legacyAi = Boolean(row?.tldr || row?.summary_markdown);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35 data-[state=open]:animate-in fade-in-0" />
        <DialogPrimitive.Content
          className="fixed z-50 flex max-h-[min(90vh,720px)] w-[calc(100vw-1.5rem)] max-w-lg flex-col rounded-xl border border-[#bebebe] bg-[#e8e8e8] p-4 shadow-[8px_8px_16px_#bebebe,-6px_-6px_14px_#ffffff] sm:p-5
          left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]
          data-[state=open]:animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-start justify-between gap-2 border-b border-[#bebebe] pb-3">
            <DialogPrimitive.Title className="pr-8 text-base font-semibold text-[#2d2d2d] sm:text-lg">
              {row?.subject ?? "Newsletter"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              type="button"
              className="rounded-lg border border-[#bebebe] bg-[#e0e0e0] p-2 text-[#2d2d2d] shadow-[2px_2px_4px_#bebebe] hover:shadow-[inset_2px_2px_4px_#bebebe] touch-manipulation"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Original newsletter email
          </DialogPrimitive.Description>

          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 text-sm text-[#444]">
            {row && (
              <>
                <p>
                  <span className="font-medium text-[#2d2d2d]">From:</span> {row.from_address || "—"}
                </p>
                <p>
                  <span className="font-medium text-[#2d2d2d]">Received:</span>{" "}
                  {formatDate(row.received_at || row.created_at)}
                </p>
                {row.link_primary && (
                  <p>
                    <a
                      href={row.link_primary}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#1d4ed8] underline break-all"
                    >
                      Open original message
                    </a>
                  </p>
                )}
                {legacyAi && (
                  <div className="rounded-md border border-[#ccc] bg-[#f0f0f0] p-2 text-xs text-[#555]">
                    <p className="font-medium text-[#2d2d2d]">Legacy per-email AI summary</p>
                    {row.tldr && <p className="mt-1">{row.tldr}</p>}
                    {row.summary_markdown && (
                      <div className="mt-1">
                        <SimpleMarkdown source={row.summary_markdown} />
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <p className="font-medium text-[#2d2d2d]">Full text</p>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-[#ccc] bg-[#f4f4f4] p-2 text-xs text-[#333] sm:text-sm">
                    {row.raw_text || "—"}
                  </pre>
                </div>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
