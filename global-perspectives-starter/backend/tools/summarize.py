
from typing import List, Dict, Any, Union, Optional
import re

def extractive_phrases(title: str, description: Optional[str], max_phrases: int = 5) -> List[str]:
    chunks = []
    if title:
        chunks.append(title.strip())
    if description:
        # split on punctuation; pick short neutral phrases
        parts = re.split(r"[.;:!?]", description)
        for p in parts:
            pp = p.strip()
            if 8 <= len(pp) <= 160:
                chunks.append(pp)
    # de-duplicate
    seen = set()
    result = []
    for c in chunks:
        if c and c not in seen:
            seen.add(c)
            result.append(c)
        if len(result) >= max_phrases:
            break
    return result[:max_phrases]

def summarize(articles: List[Dict[str, Any]], max_phrases: int = 5) -> List[Dict[str, Any]]:
    for a in articles:
        a["summary_phrases"] = extractive_phrases(a.get("title"), a.get("description"), max_phrases=max_phrases)
    return articles
