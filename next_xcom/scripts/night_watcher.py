#!/usr/bin/env python3
"""
Night Watcher worker for Scouter.

Polls scouter_youtube_queue, downloads audio with yt-dlp, transcribes with Whisper,
extracts SOP JSON via xAI Grok, generates embeddings, and stores output in scouter_knowledge.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    or os.getenv("SUPABASE_SERVICE_KEY", "").strip()
)
XAI_API_KEY = os.getenv("XAI_API_KEY", "").strip() or os.getenv("GROK_API_KEY", "").strip()
SCOUTER_MODEL = os.getenv("SCOUTER_GROK_MODEL", "grok-3-mini")
SCOUTER_EMBED_MODEL = os.getenv("SCOUTER_EMBEDDING_MODEL", "text-embedding-3-small")
POLL_INTERVAL_SEC = int(os.getenv("SCOUTER_NIGHT_WATCHER_POLL_SEC", "30"))
WHISPER_MODEL = os.getenv("SCOUTER_WHISPER_MODEL", "base")


def require_env() -> None:
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not XAI_API_KEY:
        missing.append("XAI_API_KEY")
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")


def sb_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def sb_get(path: str, params: Dict[str, str]) -> Any:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    resp = requests.get(url, headers=sb_headers(), params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def sb_patch(path: str, params: Dict[str, str], payload: Dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    resp = requests.patch(url, headers=sb_headers(), params=params, json=payload, timeout=30)
    resp.raise_for_status()


def sb_post(path: str, payload: Dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = sb_headers()
    headers["Prefer"] = "return=minimal"
    resp = requests.post(url, headers=headers, json=payload, timeout=45)
    resp.raise_for_status()


def fetch_next_queue_item() -> Optional[Dict[str, Any]]:
    rows = sb_get(
        "scouter_youtube_queue",
        {
            "select": "id,source_url,status",
            "status": "eq.queued",
            "order": "created_at.asc",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


def mark_queue(item_id: str, status: str, error_message: Optional[str] = None) -> None:
    payload: Dict[str, Any] = {"status": status}
    if error_message is not None:
        payload["error_message"] = error_message[:2000]
    if status in ("done", "error"):
        payload["processed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    sb_patch("scouter_youtube_queue", {"id": f"eq.{item_id}"}, payload)


def run_cmd(cmd: List[str], cwd: Optional[str] = None) -> None:
    subprocess.run(cmd, check=True, cwd=cwd)


def transcribe_youtube(url: str) -> str:
    with tempfile.TemporaryDirectory(prefix="scouter_nw_") as td:
        workdir = Path(td)
        audio_base = workdir / "input"
        # Downloads best audio and converts to wav.
        run_cmd(
            [
                "yt-dlp",
                "--extract-audio",
                "--audio-format",
                "wav",
                "--output",
                str(audio_base) + ".%(ext)s",
                url,
            ]
        )
        wav_files = list(workdir.glob("input*.wav"))
        if not wav_files:
            raise RuntimeError("yt-dlp did not produce a WAV file")
        wav = str(wav_files[0])
        run_cmd(
            [
                "whisper",
                wav,
                "--model",
                WHISPER_MODEL,
                "--output_dir",
                str(workdir),
                "--output_format",
                "txt",
            ]
        )
        txt_files = list(workdir.glob("*.txt"))
        if not txt_files:
            raise RuntimeError("Whisper did not produce a transcript .txt file")
        return txt_files[0].read_text(encoding="utf-8").strip()


def xai_chat(prompt: str, max_tokens: int = 1400, temperature: float = 0.3) -> str:
    resp = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": SCOUTER_MODEL,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {
                    "role": "system",
                    "content": "You convert transcripts into SOP knowledge JSON. Output JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


def xai_embedding(text: str) -> Optional[List[float]]:
    resp = requests.post(
        "https://api.x.ai/v1/embeddings",
        headers={
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": SCOUTER_EMBED_MODEL, "input": text[:12000]},
        timeout=60,
    )
    if resp.status_code >= 400:
        return None
    data = resp.json()
    rows = data.get("data") or []
    if not rows:
        return None
    emb = rows[0].get("embedding")
    return emb if isinstance(emb, list) else None


def clean_json_text(raw: str) -> str:
    t = raw.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.lower().startswith("json"):
            t = t[4:].strip()
    return t.strip()


def process_item(item: Dict[str, Any]) -> None:
    item_id = str(item["id"])
    source_url = str(item["source_url"])
    mark_queue(item_id, "processing")
    transcript = transcribe_youtube(source_url)
    if not transcript:
        raise RuntimeError("Transcript is empty")

    prompt = (
        "Create a compact SOP JSON with keys: objective, prerequisites, steps, tools, pitfalls, summary.\n"
        "Keep values concise and practical.\n\n"
        f"TRANSCRIPT:\n{transcript[:50000]}"
    )
    sop_json_raw = xai_chat(prompt, max_tokens=1800, temperature=0.25)
    sop_json_text = clean_json_text(sop_json_raw)
    sop = json.loads(sop_json_text)
    summary = sop.get("summary") or transcript[:900]
    title = sop.get("objective") or "YouTube SOP"

    embedding = xai_embedding(f"{title}\n\n{summary}\n\n{source_url}")

    payload = {
        "title": str(title)[:300],
        "content_raw": transcript[:200000],
        "summary": json.dumps(sop, ensure_ascii=False)[:30000],
        "source_type": "youtube",
        "source_url": source_url,
        "embedding": embedding,
    }
    sb_post("scouter_knowledge", payload)
    mark_queue(item_id, "done")


def main() -> None:
    require_env()
    print("Night Watcher started.")
    while True:
        try:
            item = fetch_next_queue_item()
            if not item:
                time.sleep(POLL_INTERVAL_SEC)
                continue
            print(f"Processing queue item: {item['id']}")
            process_item(item)
        except Exception as exc:  # pylint: disable=broad-except
            msg = str(exc)
            print(f"Night Watcher error: {msg}")
            # Best effort: if we can detect current item, mark it error.
            try:
                if "item" in locals() and item and item.get("id"):
                    mark_queue(str(item["id"]), "error", msg)
            except Exception:
                pass
            time.sleep(10)


if __name__ == "__main__":
    main()
