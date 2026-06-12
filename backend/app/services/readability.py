import re
import textstat


def safe_readability_metrics(text: str) -> dict:
    clean_text = text.strip()
    if not clean_text:
        return {
            "flesch_reading_ease": 0.0,
            "flesch_kincaid_grade": 0.0,
            "avg_sentence_length": 0.0,
            "passive_voice_percent": 0.0,
        }

    sentences = re.split(r"[.!?]+", clean_text)
    non_empty_sentences = [s.strip() for s in sentences if s.strip()]
    words = re.findall(r"\b\w+\b", clean_text)

    passive_hits = len(re.findall(r"\b(is|are|was|were|be|been|being)\s+\w+ed\b", clean_text.lower()))
    passive_percent = (passive_hits / max(1, len(non_empty_sentences))) * 100

    return {
        "flesch_reading_ease": round(textstat.flesch_reading_ease(clean_text), 2),
        "flesch_kincaid_grade": round(textstat.flesch_kincaid_grade(clean_text), 2),
        "avg_sentence_length": round(len(words) / max(1, len(non_empty_sentences)), 2),
        "passive_voice_percent": round(passive_percent, 2),
    }
