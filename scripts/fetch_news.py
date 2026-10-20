#!/usr/bin/env python3
"""Fetch top news from verified RSS/Atom feeds into data/news.json.

Stdlib only (urllib + xml.etree). Run daily by cron:
    python3 scripts/fetch_news.py
Feeds verified working on 2026-10-20 (see dashboard research notes).
"""
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "news.json"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
PER_CATEGORY = 8
TIMEOUT = 20

FEEDS = {
    "bangladesh": [
        ("প্রথম আলো", "https://www.prothomalo.com/feed"),
        ("Daily Star", "https://www.thedailystar.net/rss.xml"),
        ("BBC বাংলা", "https://www.bbc.com/bengali/index.xml"),
    ],
    "tech": [
        ("TechCrunch", "https://techcrunch.com/feed/"),
        ("The Verge", "https://www.theverge.com/rss/index.xml"),
        ("MIT Technology Review", "https://www.technologyreview.com/feed/"),
    ],
    "world": [
        ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
        ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
        ("BBC News", "https://feeds.bbci.co.uk/news/rss.xml"),
    ],
}


def local(tag):
    return tag.rsplit("}", 1)[-1]


def children(el, name):
    return [c for c in el if local(c.tag) == name]


def first(el, name):
    for c in el:
        if local(c.tag) == name:
            return c
    return None


def text_of(el):
    if el is None:
        return ""
    return "".join(el.itertext()).strip()


def clean(raw, limit=160):
    if not raw:
        return ""
    s = re.sub(r"<[^>]+>", " ", raw)
    s = html.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > limit:
        cut = s[:limit].rsplit(" ", 1)[0]
        s = (cut or s[:limit]) + "…"
    return s


def parse_dt(raw):
    if not raw:
        return None
    raw = raw.strip()
    try:
        dt = parsedate_to_datetime(raw)
        if dt is not None:
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        pass
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


_bengali_re = re.compile("[\u0980-\u09fe]")


def has_bengali(s):
    return bool(_bengali_re.search(s or ""))


def translate_bn(text):
    """Machine-translate a headline to Bengali (Google Translate public
    endpoint). Returns '' on any failure — caller keeps the original."""
    if not text:
        return ""
    try:
        from urllib.parse import quote
        url = ("https://translate.googleapis.com/translate_a/single"
               f"?client=gtx&sl=auto&tl=bn&dt=t&q={quote(text)}")
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode("utf-8"))
        out = "".join(seg[0] for seg in data[0] if seg and seg[0]).strip()
        return out if has_bengali(out) else ""
    except Exception:
        return ""


def parse_feed(data):
    """Return list of raw item dicts from RSS or Atom bytes."""
    root = ET.fromstring(data)
    items = []
    if local(root.tag) == "feed":  # Atom
        for entry in children(root, "entry"):
            link = ""
            for lnk in children(entry, "link"):
                if lnk.get("rel") in (None, "alternate"):
                    link = lnk.get("href", "")
                    break
            summary = text_of(first(entry, "summary")) or text_of(first(entry, "content"))
            published = text_of(first(entry, "published")) or text_of(first(entry, "updated"))
            items.append({
                "title": text_of(first(entry, "title")),
                "summary": summary,
                "link": link,
                "published": parse_dt(published),
            })
    else:  # RSS
        for item in root.iter():
            if local(item.tag) != "item":
                continue
            items.append({
                "title": text_of(first(item, "title")),
                "summary": text_of(first(item, "description")),
                "link": text_of(first(item, "link")),
                "published": parse_dt(text_of(first(item, "pubDate"))),
            })
    return items


def main():
    result = {"updated": datetime.now(timezone.utc).isoformat()}
    for cat, feeds in FEEDS.items():
        pool = []
        for source, url in feeds:
            try:
                raw = fetch(url)
                for it in parse_feed(raw):
                    if not it["title"] or not it["link"]:
                        continue
                    pool.append({
                        "source": source,
                        "title": clean(it["title"], 300),
                        "summary": clean(it["summary"]),
                        "link": it["link"],
                        "published": it["published"].isoformat() if it["published"] else None,
                        "_dt": it["published"] or datetime.min.replace(tzinfo=timezone.utc),
                    })
                print(f"ok   {cat:11s} {source}", file=sys.stderr)
            except Exception as e:  # keep going with the rest
                print(f"FAIL {cat:11s} {source}: {e}", file=sys.stderr)
        pool.sort(key=lambda x: x["_dt"], reverse=True)
        seen, top = set(), []
        for it in pool:
            if it["title"] in seen:
                continue
            seen.add(it["title"])
            del it["_dt"]
            top.append(it)
            if len(top) >= PER_CATEGORY:
                break
        for it in top:
            if not has_bengali(it["title"]):
                bn = translate_bn(it["title"])
                if bn and bn != it["title"]:
                    it["title_bn"] = bn
        result[cat] = top
        print(f"--> {cat}: {len(top)} items", file=sys.stderr)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
