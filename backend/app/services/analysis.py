import json
import logging
import re
from difflib import SequenceMatcher
from typing import Any
from litellm import completion

from app.core.config import get_settings
from app.schemas.analysis import (
    DocumentChatResponse,
    ExplainImageResponse,
    ExplainSelectionResponse,
    FeedbackIssue,
    FeedbackReportResponse,
    ReaderSimulationResponse,
    SummarizeBookResponse,
    TranslateSelectionResponse,
)
from app.services.readability import safe_readability_metrics


SYSTEM_PROMPT = """
You are WriterLoop AI, an elite writing feedback coach.
Return strict JSON only.
Assess grammar, clarity, logic, structure, and tone.
Provide actionable recommendations.
""".strip()

logger = logging.getLogger(__name__)


class AIProviderError(Exception):
    """Raised when upstream model provider calls fail."""


def _format_provider_error(exc: Exception) -> str:
    raw = str(exc).replace("\n", " ").strip()
    lower = raw.lower()

    if "resource_exhausted" in lower or "quota" in lower or "429" in lower:
        return "AI provider quota exceeded. Check Gemini billing/credits and try again."

    if (
        "api key" in lower
        and ("invalid" in lower or "missing" in lower or "unauthorized" in lower or "permission" in lower)
    ):
        return "AI provider authentication failed. Verify GEMINI_API_KEY."

    return "AI provider call failed. Please retry in a moment."


def _load_json_payload(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if not text:
        raise ValueError("Empty provider response")

    try:
        loaded = json.loads(text)
        if isinstance(loaded, dict):
            return loaded
    except Exception:
        pass

    fenced_match = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", text, flags=re.IGNORECASE)
    if fenced_match:
        loaded = json.loads(fenced_match.group(1))
        if isinstance(loaded, dict):
            return loaded

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        loaded = json.loads(text[start : end + 1])
        if isinstance(loaded, dict):
            return loaded

    raise ValueError("Could not parse JSON payload from provider response")


def _call_gemini(
    messages: list[dict[str, str]],
    temperature: float = 0.2,
    response_format: dict[str, str] | None = None,
) -> str:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise AIProviderError("GEMINI_API_KEY is not configured")

    payload: dict[str, Any] = {}
    if response_format is not None:
        payload["response_format"] = response_format

    response = completion(
        model=f"gemini/{settings.gemini_model}",
        api_key=settings.gemini_api_key,
        messages=messages,
        temperature=temperature,
        **payload,
    )
    return response.choices[0].message.content.strip()


def _heuristic_feedback(text: str) -> FeedbackReportResponse:
    readability = safe_readability_metrics(text)

    words = re.findall(r"\b\w+\b", text)
    sentences = re.split(r"[.!?]+", text)
    sentence_count = max(1, len([s for s in sentences if s.strip()]))
    avg_sentence_len = len(words) / sentence_count

    clarity_score = max(40, min(98, int(100 - abs(avg_sentence_len - 18) * 1.8)))
    grammar_score = max(55, min(99, 94 - text.count("  ") * 2))
    logic_score = 80
    structure_score = max(60, min(98, 88 - int(readability["flesch_kincaid_grade"] / 2)))
    tone_score = 85
    overall = int((grammar_score + clarity_score + logic_score + structure_score + tone_score) / 5)

    issues: list[FeedbackIssue] = []
    recommendations: list[str] = []

    if avg_sentence_len > 26:
        issues.append(
            FeedbackIssue(
                category="clarity",
                message="Several sentences are long and hard to parse.",
                severity="high",
            )
        )
        recommendations.append("Split long sentences into shorter units with one core idea each.")

    if readability["flesch_kincaid_grade"] > 11:
        issues.append(
            FeedbackIssue(
                category="readability",
                message="Readability level may be too advanced for broad audiences.",
                severity="medium",
            )
        )
        recommendations.append("Replace jargon with concrete language and add quick examples.")

    if not recommendations:
        recommendations.append("Great baseline. Tighten transitions to improve narrative flow.")

    return FeedbackReportResponse(
        grammar_score=grammar_score,
        clarity_score=clarity_score,
        logic_score=logic_score,
        structure_score=structure_score,
        tone_score=tone_score,
        overall_score=overall,
        readability_score=readability["flesch_reading_ease"],
        issues=issues,
        recommendations=recommendations,
    )


def analyze_text(text: str) -> FeedbackReportResponse:
    settings = get_settings()

    if not settings.gemini_api_key:
        return _heuristic_feedback(text)

    schema_hint = {
        "grammar_score": 0,
        "clarity_score": 0,
        "logic_score": 0,
        "structure_score": 0,
        "tone_score": 0,
        "overall_score": 0,
        "readability_score": 0,
        "issues": [{"category": "", "message": "", "severity": "medium", "span": ""}],
        "recommendations": [""],
    }

    prompt = (
        "Analyze the writing and return JSON that matches this shape exactly: "
        f"{json.dumps(schema_hint)}\n\n"
        f"Text:\n{text}"
    )

    try:
        response = completion(
            model=f"gemini/{settings.gemini_model}",
            api_key=settings.gemini_api_key,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        content = response.choices[0].message.content
        parsed = json.loads(content)
        return FeedbackReportResponse.model_validate(parsed)
    except Exception as exc:
        logger.exception("Gemini analyze_text failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def rewrite_text(text: str, mode: str) -> str:
    settings = get_settings()

    if not settings.gemini_api_key:
        if mode.lower() == "make concise":
            return text[: max(200, int(len(text) * 0.75))]
        return f"[{mode}]\n{text}"

    prompt = f"Rewrite this text in mode: {mode}. Preserve meaning and improve quality.\n\n{text}"

    try:
        response = completion(
            model=f"gemini/{settings.gemini_model}",
            api_key=settings.gemini_api_key,
            messages=[
                {"role": "system", "content": "You are an expert writing editor."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.exception("Gemini rewrite_text failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def live_correct_text(text: str, previous_text: str | None = None) -> tuple[str, int]:
    settings = get_settings()
    original = text
    candidate = text.strip("\n")

    if not candidate:
        return original, 0

    if not settings.gemini_api_key:
        return original, 0

    schema_hint = {"corrected_text": "", "corrections": 0}
    clipped_previous = (previous_text or "").strip()[:4000]

    prompt = (
        "Correct spelling and grammar only.\n"
        "Do not paraphrase, summarize, expand, or change intent.\n"
        "Keep line breaks and structure as close as possible.\n"
        "Return strict JSON matching this shape:\n"
        f"{json.dumps(schema_hint)}\n\n"
        f"Previous text (optional context):\n{clipped_previous or 'N/A'}\n\n"
        f"Current text:\n{candidate[:6000]}"
    )

    try:
        response = completion(
            model=f"gemini/{settings.gemini_model}",
            api_key=settings.gemini_api_key,
            messages=[
                {"role": "system", "content": "You are a precise grammar and spelling corrector."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )
        parsed = json.loads(response.choices[0].message.content)
        corrected = str(parsed.get("corrected_text", "")).strip("\n") or candidate
        model_count = parsed.get("corrections", 0)
        try:
            corrections = max(0, int(model_count))
        except Exception:
            corrections = 0

        if not corrections:
            corrections = _estimate_change_count(candidate, corrected)

        return corrected, corrections
    except Exception as exc:
        logger.exception("Gemini live_correct_text failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def _estimate_change_count(before: str, after: str) -> int:
    if before == after:
        return 0
    matcher = SequenceMatcher(None, before, after)
    return sum(1 for opcode in matcher.get_opcodes() if opcode[0] != "equal")


def simulate_reader(text: str, role: str) -> ReaderSimulationResponse:
    settings = get_settings()

    if not settings.gemini_api_key:
        return ReaderSimulationResponse(
            role=role,
            questions=[f"As a {role}, what is the key outcome you want from this text?"],
            confusions=["Some core assumptions are implied rather than explicit."],
            objections=["The evidence backing major claims is not fully developed."],
            suggestions=["Add one concrete example and one measurable result."],
        )

    schema_hint = {
        "questions": [""],
        "confusions": [""],
        "objections": [""],
        "suggestions": [""],
    }

    prompt = (
        f"Simulate a {role} reading this document. Return JSON only in this shape: "
        f"{json.dumps(schema_hint)}\n\nText:\n{text}"
    )

    try:
        response = completion(
            model=f"gemini/{settings.gemini_model}",
            api_key=settings.gemini_api_key,
            messages=[
                {"role": "system", "content": "You are simulating real reader reactions."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        parsed = json.loads(response.choices[0].message.content)
        return ReaderSimulationResponse(
            role=role,
            questions=parsed.get("questions", []),
            confusions=parsed.get("confusions", []),
            objections=parsed.get("objections", []),
            suggestions=parsed.get("suggestions", []),
        )
    except Exception as exc:
        logger.exception("Gemini simulate_reader failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def answer_question_about_text(text: str, question: str, context: str | None = None) -> str:
    settings = get_settings()
    normalized_text = text.strip()

    if not normalized_text:
        return "No text was selected. Highlight a word, phrase, or section first."

    if not settings.gemini_api_key:
        if len(normalized_text.split()) <= 4:
            return f"Meaning (fallback): '{normalized_text}' likely needs contextual interpretation."
        return (
            "Fallback explanation: this passage appears to discuss a key idea that can be clarified by "
            "breaking it into simpler sentences and concrete examples."
        )

    clipped_text = normalized_text[:12000]
    clipped_context = (context or "").strip()[:12000]
    question_text = question.strip() or "Explain this in simple words."

    prompt = (
        "You are a writing assistant inside a document reader.\n"
        "Answer the user's question about the selected text clearly and concisely.\n"
        "If asked for meaning, provide a plain-language explanation and one brief example.\n\n"
        f"Question:\n{question_text}\n\n"
        f"Selected text:\n{clipped_text}\n\n"
        f"Document context (optional):\n{clipped_context or 'N/A'}"
    )

    try:
        response = completion(
            model=f"gemini/{settings.gemini_model}",
            api_key=settings.gemini_api_key,
            messages=[
                {"role": "system", "content": "You are a precise reading and comprehension assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.25,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.exception("Gemini answer_question_about_text failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def explain_selection_with_gemini(
    selected_text: str, surrounding_context: str | None = None
) -> ExplainSelectionResponse:
    normalized_text = selected_text.strip()
    if not normalized_text:
        return ExplainSelectionResponse(
            definition="No selection provided.",
            meaning_in_context="Select a word or sentence in the reader first.",
            usage_examples=[],
            concise_explanation="Choose text in the document and try again.",
            detected_language="",
            translation_to_english="",
            math_interpretation="",
            math_solution="",
        )

    settings = get_settings()
    if not settings.gemini_api_key:
        return ExplainSelectionResponse(
            definition=f"Fallback: {normalized_text}",
            meaning_in_context=(
                "Gemini key is missing, so this is a local fallback. "
                "Add GEMINI_API_KEY to enable contextual explanations."
            ),
            usage_examples=[
                f"Example 1: {normalized_text}",
                f"Example 2: The idea of '{normalized_text}' depends on context.",
            ],
            concise_explanation="Configure GEMINI_API_KEY to use AI contextual explanations.",
            detected_language="",
            translation_to_english="",
            math_interpretation="",
            math_solution="",
        )

    schema_hint = {
        "definition": "",
        "meaning_in_context": "",
        "usage_examples": ["", "", ""],
        "concise_explanation": "",
        "detected_language": "",
        "translation_to_english": "",
        "math_interpretation": "",
        "math_solution": "",
    }

    prompt = (
        "You are an expert reading tutor.\n"
        "Return strict JSON only in this exact shape:\n"
        f"{json.dumps(schema_hint)}\n\n"
        "Instructions:\n"
        "- Provide a dictionary-style definition.\n"
        "- Explain meaning in the current context.\n"
        "- Give 2-3 clear usage examples.\n"
        "- Keep concise_explanation short and practical.\n"
        "- If the selected text is not English, fill detected_language and translation_to_english.\n"
        "- If it includes a math expression, formula, or word problem, fill math_interpretation and math_solution.\n"
        "- If not applicable, leave optional fields as empty strings.\n\n"
        f"Selected text:\n{normalized_text[:2000]}\n\n"
        f"Surrounding context:\n{(surrounding_context or 'N/A')[:6000]}"
    )

    try:
        raw = _call_gemini(
            messages=[
                {"role": "system", "content": "You explain words and passages with precision and clarity."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        parsed = _load_json_payload(raw)
        return ExplainSelectionResponse(
            definition=str(parsed.get("definition", "")).strip(),
            meaning_in_context=str(parsed.get("meaning_in_context", "")).strip(),
            usage_examples=[str(item).strip() for item in parsed.get("usage_examples", []) if str(item).strip()],
            concise_explanation=str(parsed.get("concise_explanation", "")).strip(),
            detected_language=str(parsed.get("detected_language", "")).strip(),
            translation_to_english=str(parsed.get("translation_to_english", "")).strip(),
            math_interpretation=str(parsed.get("math_interpretation", "")).strip(),
            math_solution=str(parsed.get("math_solution", "")).strip(),
        )
    except Exception as exc:
        logger.exception("Gemini explain_selection_with_gemini failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def explain_image_with_gemini(
    image_url: str,
    prompt: str = "Explain this image.",
    surrounding_context: str | None = None,
) -> ExplainImageResponse:
    normalized_image = image_url.strip()
    if not normalized_image:
        return ExplainImageResponse(
            concise_explanation="No image selected.",
            key_points=["Select an image and try again."],
            detected_language="",
            translated_text="",
            math_solution="",
        )

    settings = get_settings()
    if not settings.gemini_api_key:
        return ExplainImageResponse(
            concise_explanation="Gemini key is missing, so image explanation is unavailable.",
            key_points=["Configure Gemini API key from dashboard settings."],
            detected_language="",
            translated_text="",
            math_solution="",
        )

    schema_hint = {
        "concise_explanation": "",
        "key_points": ["", "", ""],
        "detected_language": "",
        "translated_text": "",
        "math_solution": "",
    }

    text_prompt = (
        "You are an image understanding assistant inside a document reader.\n"
        "Return strict JSON only in this exact shape:\n"
        f"{json.dumps(schema_hint)}\n\n"
        "Rules:\n"
        "- Explain the image in plain language.\n"
        "- Mention key visual evidence.\n"
        "- Keep concise_explanation short and useful.\n"
        "- If image text is non-English, detect language and provide translated_text in English.\n"
        "- If image contains a math formula/calculation, provide math_solution with concise steps.\n"
        "- If not applicable, leave optional fields empty.\n\n"
        f"User prompt:\n{(prompt or 'Explain this image.').strip()[:1000]}\n\n"
        f"Surrounding context:\n{(surrounding_context or 'N/A')[:4000]}"
    )

    try:
        response = completion(
            model=f"gemini/{settings.gemini_model}",
            api_key=settings.gemini_api_key,
            messages=[
                {"role": "system", "content": "You explain document images accurately and clearly."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text_prompt},
                        {"type": "image_url", "image_url": {"url": normalized_image}},
                    ],
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        parsed = _load_json_payload(response.choices[0].message.content)
        return ExplainImageResponse(
            concise_explanation=str(parsed.get("concise_explanation", "")).strip(),
            key_points=[str(item).strip() for item in parsed.get("key_points", []) if str(item).strip()],
            detected_language=str(parsed.get("detected_language", "")).strip(),
            translated_text=str(parsed.get("translated_text", "")).strip(),
            math_solution=str(parsed.get("math_solution", "")).strip(),
        )
    except Exception as exc:
        logger.exception("Gemini explain_image_with_gemini failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def summarize_book_with_gemini(text: str, title: str | None = None) -> SummarizeBookResponse:
    normalized_text = text.strip()
    if not normalized_text:
        return SummarizeBookResponse(
            overall_summary="No readable content was provided.",
            key_themes=[],
            main_characters=[],
            chapter_breakdown=[],
        )

    settings = get_settings()
    if not settings.gemini_api_key:
        return SummarizeBookResponse(
            overall_summary=(
                "Gemini key is missing. Add GEMINI_API_KEY to generate full AI book summaries."
            ),
            key_themes=["Configuration required", "Reader workflow", "AI-assisted understanding"],
            main_characters=[],
            chapter_breakdown=[],
        )

    limited_text = normalized_text[:50000]
    schema_hint = {
        "overall_summary": "",
        "key_themes": ["", "", ""],
        "main_characters": [""],
        "chapter_breakdown": [{"chapter": "", "summary": ""}],
    }

    prompt = (
        "You are a book analyst.\n"
        "Return strict JSON only in this exact shape:\n"
        f"{json.dumps(schema_hint)}\n\n"
        "Instructions:\n"
        "- Give a high-quality overall summary.\n"
        "- Extract key themes.\n"
        "- If fiction, list main characters, else return an empty list.\n"
        "- Provide chapter-by-chapter breakdown from available text sections.\n\n"
        f"Title:\n{(title or 'Untitled')[:300]}\n\n"
        f"Book content (possibly truncated):\n{limited_text}"
    )

    try:
        raw = _call_gemini(
            messages=[
                {"role": "system", "content": "You write rich but clear book summaries."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        parsed = _load_json_payload(raw)

        chapter_breakdown = []
        for item in parsed.get("chapter_breakdown", []):
            if not isinstance(item, dict):
                continue
            chapter = str(item.get("chapter", "")).strip()
            summary = str(item.get("summary", "")).strip()
            if chapter or summary:
                chapter_breakdown.append({"chapter": chapter or "Section", "summary": summary})

        return SummarizeBookResponse(
            overall_summary=str(parsed.get("overall_summary", "")).strip(),
            key_themes=[str(item).strip() for item in parsed.get("key_themes", []) if str(item).strip()],
            main_characters=[str(item).strip() for item in parsed.get("main_characters", []) if str(item).strip()],
            chapter_breakdown=chapter_breakdown,
        )
    except Exception as exc:
        logger.exception("Gemini summarize_book_with_gemini failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def translate_selection_with_gemini(
    selected_text: str,
    target_language: str,
    surrounding_context: str | None = None,
) -> TranslateSelectionResponse:
    normalized_text = selected_text.strip()
    target = target_language.strip() or "English"

    if not normalized_text:
        return TranslateSelectionResponse(
            translated_text="",
            detected_source_language="",
            notes="No text selected.",
        )

    settings = get_settings()
    if not settings.gemini_api_key:
        return TranslateSelectionResponse(
            translated_text=normalized_text,
            detected_source_language="unknown",
            notes="Gemini key is missing, so translation is unavailable.",
        )

    schema_hint = {
        "translated_text": "",
        "detected_source_language": "",
        "notes": "",
    }

    prompt = (
        "You are a translation assistant inside a document reader.\n"
        "Return strict JSON only in this exact shape:\n"
        f"{json.dumps(schema_hint)}\n\n"
        "Rules:\n"
        "- Translate naturally while preserving meaning.\n"
        "- Keep domain terms and proper nouns accurate.\n"
        "- Use context to disambiguate if needed.\n\n"
        f"Target language:\n{target[:80]}\n\n"
        f"Selected text:\n{normalized_text[:4000]}\n\n"
        f"Context:\n{(surrounding_context or 'N/A')[:6000]}"
    )

    try:
        raw = _call_gemini(
            messages=[
                {
                    "role": "system",
                    "content": "You translate text accurately and preserve context meaning.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.15,
            response_format={"type": "json_object"},
        )
        parsed = _load_json_payload(raw)
        return TranslateSelectionResponse(
            translated_text=str(parsed.get("translated_text", "")).strip(),
            detected_source_language=str(parsed.get("detected_source_language", "")).strip(),
            notes=str(parsed.get("notes", "")).strip(),
        )
    except Exception as exc:
        logger.exception("Gemini translate_selection_with_gemini failed")
        raise AIProviderError(_format_provider_error(exc)) from exc


def chat_with_document_context(
    question: str,
    snippets: list[str] | None = None,
    book_title: str | None = None,
) -> DocumentChatResponse:
    normalized_question = question.strip()
    if not normalized_question:
        return DocumentChatResponse(answer="Ask a question to start the document chat.", used_snippets=0)

    cleaned_snippets = [snippet.strip() for snippet in (snippets or []) if snippet and snippet.strip()]
    used_snippets = min(len(cleaned_snippets), 8)
    merged_context = "\n\n---\n\n".join(cleaned_snippets[:used_snippets])[:16000]

    settings = get_settings()
    if not settings.gemini_api_key:
        if merged_context:
            return DocumentChatResponse(
                answer=(
                    "Gemini key is missing. Based on retrieved document snippets, "
                    "the likely answer is in the highlighted context, but AI synthesis is unavailable."
                ),
                used_snippets=used_snippets,
            )
        return DocumentChatResponse(
            answer="Gemini key is missing and no relevant snippets were found for this question.",
            used_snippets=0,
        )

    prompt = (
        "You are a context-aware document chat assistant.\n"
        "Answer the user question using the provided snippets first.\n"
        "If evidence is incomplete, clearly state uncertainty.\n"
        "Keep answer concise but useful.\n\n"
        f"Document title:\n{(book_title or 'Untitled')[:300]}\n\n"
        f"Question:\n{normalized_question[:2000]}\n\n"
        f"Retrieved snippets:\n{merged_context or 'No snippets available.'}"
    )

    try:
        response = completion(
            model=f"gemini/{settings.gemini_model}",
            api_key=settings.gemini_api_key,
            messages=[
                {"role": "system", "content": "You answer document questions with evidence-aware reasoning."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.25,
        )
        return DocumentChatResponse(
            answer=response.choices[0].message.content.strip(),
            used_snippets=used_snippets,
        )
    except Exception as exc:
        logger.exception("Gemini chat_with_document_context failed")
        raise AIProviderError(_format_provider_error(exc)) from exc
