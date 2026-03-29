"use client";

import * as React from "react";
import {
  buildQueryStringFromOptions,
  type QueryOptionsV1,
} from "@/lib/x-query-assembler";
import "./x-engager.css";

function commaToWords(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function wordsToComma(ws: string[]): string {
  return ws.join(", ");
}

export function QueryBuilderPanel({
  value,
  onChange,
  idPrefix,
  showRecommended = true,
}: {
  value: QueryOptionsV1;
  onChange: (next: QueryOptionsV1) => void;
  idPrefix: string;
  showRecommended?: boolean;
}) {
  const allWordsStr = wordsToComma(value.allWords);
  const anyWordsStr = wordsToComma(value.anyWords);
  const hashStr = wordsToComma(value.recommendedHashtags);

  const patch = (partial: Partial<QueryOptionsV1>) => {
    onChange({ ...value, ...partial });
  };

  const preview = buildQueryStringFromOptions(value);

  return (
    <div className="xe-query-builder">
      <div className="xe-qb-row">
        <label htmlFor={`${idPrefix}-all`}>All of these words (comma-separated)</label>
        <input
          id={`${idPrefix}-all`}
          type="text"
          value={allWordsStr}
          onChange={(e) =>
            patch({ allWords: commaToWords(e.target.value) })
          }
          placeholder="remote, SaaS, shipping"
        />
      </div>
      <div className="xe-qb-row">
        <label htmlFor={`${idPrefix}-exact`}>This exact phrase</label>
        <input
          id={`${idPrefix}-exact`}
          type="text"
          value={value.exactPhrase}
          onChange={(e) => patch({ exactPhrase: e.target.value })}
          placeholder="build in public"
        />
      </div>
      <div className="xe-qb-row">
        <label htmlFor={`${idPrefix}-any`}>Any of these words (comma-separated OR group)</label>
        <input
          id={`${idPrefix}-any`}
          type="text"
          value={anyWordsStr}
          onChange={(e) =>
            patch({ anyWords: commaToWords(e.target.value) })
          }
          placeholder="dev, indie, Cursor, #buildinpublic"
        />
      </div>
      <div className="xe-qb-row">
        <label htmlFor={`${idPrefix}-lang`}>Language</label>
        <input
          id={`${idPrefix}-lang`}
          type="text"
          value={value.lang}
          onChange={(e) => patch({ lang: e.target.value.trim() || "en" })}
          placeholder="en"
        />
      </div>
      <div className="xe-qb-metrics">
        <div>
          <label htmlFor={`${idPrefix}-mf`}>Min likes</label>
          <input
            id={`${idPrefix}-mf`}
            type="number"
            min={0}
            value={value.minFaves ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              patch({
                minFaves: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
              });
            }}
            placeholder="empty = none"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-mr`}>Min reposts</label>
          <input
            id={`${idPrefix}-mr`}
            type="number"
            min={0}
            value={value.minRetweets ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              patch({
                minRetweets: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
              });
            }}
            placeholder="empty = none"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-mre`}>Min replies</label>
          <input
            id={`${idPrefix}-mre`}
            type="number"
            min={0}
            value={value.minReplies ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              patch({
                minReplies: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
              });
            }}
            placeholder="empty = none"
          />
        </div>
      </div>

      <div className="xe-qb-row">
        <label className="xe-qb-toggle">
          <input
            type="checkbox"
            checked={value.repliesToggleOn}
            onChange={(e) =>
              patch({ repliesToggleOn: e.target.checked })
            }
          />
          Replies filter (show options when on)
        </label>
      </div>
      {value.repliesToggleOn && (
        <div className="xe-qb-radio-group" role="radiogroup">
          <label>
            <input
              type="radio"
              name={`${idPrefix}-rep`}
              checked={value.repliesMode === "include_all"}
              onChange={() => patch({ repliesMode: "include_all" })}
            />
            Include replies and original posts
          </label>
          <label>
            <input
              type="radio"
              name={`${idPrefix}-rep`}
              checked={value.repliesMode === "only_replies"}
              onChange={() => patch({ repliesMode: "only_replies" })}
            />
            Only replies
          </label>
        </div>
      )}

      <div className="xe-qb-row">
        <label className="xe-qb-toggle">
          <input
            type="checkbox"
            checked={value.linksToggleOn}
            onChange={(e) =>
              patch({ linksToggleOn: e.target.checked })
            }
          />
          Links filter (show options when on)
        </label>
      </div>
      {value.linksToggleOn && (
        <div className="xe-qb-radio-group" role="radiogroup">
          <label>
            <input
              type="radio"
              name={`${idPrefix}-lnk`}
              checked={value.linksMode === "include_all"}
              onChange={() => patch({ linksMode: "include_all" })}
            />
            Include posts with or without links
          </label>
          <label>
            <input
              type="radio"
              name={`${idPrefix}-lnk`}
              checked={value.linksMode === "only_with_links"}
              onChange={() => patch({ linksMode: "only_with_links" })}
            />
            Only posts with links
          </label>
        </div>
      )}

      {showRecommended && (
        <div className="xe-qb-row xe-qb-recommended">
          <label htmlFor={`${idPrefix}-hash`}>
            Recommended hashtags (comma-separated, optional — add to “Any” or query manually)
          </label>
          <input
            id={`${idPrefix}-hash`}
            type="text"
            value={hashStr}
            onChange={(e) =>
              patch({
                recommendedHashtags: commaToWords(e.target.value).map((h) =>
                  h.startsWith("#") ? h : `#${h.replace(/^#+/, "")}`
                ),
              })
            }
            placeholder="#buildinpublic, #indiehackers"
          />
        </div>
      )}

      <div className="xe-qb-preview">
        <span className="xe-qb-preview-label">Live preview (X API v2)</span>
        <code className="xe-qb-preview-code">{preview}</code>
        <span className="xe-qb-preview-meta">
          {preview.length} / 512 chars
          {preview.length > 512 && (
            <span className="xe-qb-preview-warn"> — over limit</span>
          )}
        </span>
      </div>
    </div>
  );
}
