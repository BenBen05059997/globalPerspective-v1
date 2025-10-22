
from typing import List, Dict, Any
from rapidfuzz import fuzz

def normalize_articles(raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for a in raw:
        out.append({
            "source_id": (a.get("source") or {}).get("id"),
            "source_name": (a.get("source") or {}).get("name"),
            "publisher_country": None,  # fill from mapping later
            "origin_country_guess": None,
            "url": a.get("url"),
            "title": a.get("title") or "",
            "description": a.get("description"),
            "published_at": a.get("publishedAt"),
            "language": a.get("language") or None,
            "is_conflict": False,
            "summary_phrases": [],
            "locations": [],
            "classification": None,
        })
    return dedupe(out)

def dedupe(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    unique = []
    seen = set()
    for it in items:
        key = (it.get("url") or "").strip()
        title = (it.get("title") or "").lower().strip()
        if key and key in seen:
            continue
        # naive near-dup check against existing titles
        dup = False
        for u in unique:
            if fuzz.token_set_ratio(title, (u.get("title") or "").lower()) >= 90:
                dup = True
                break
        if not dup:
            if key:
                seen.add(key)
            unique.append(it)
    return unique
