"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";

import { liveCorrectText, quickAnalyze, rewriteContent, simulateReader } from "@/lib/api";
import type { FeedbackReport, ReaderSimulation } from "@/lib/types";
import { ScoreCard } from "@/components/score-card";

const rewriteModes = [
  "Make Shorter",
  "Make Longer",
  "Make Professional",
  "Make Technical",
  "Make Academic",
  "Make Beginner Friendly",
  "Make Persuasive",
  "Make Concise"
] as const;

const readerRoles = [
  "Investor",
  "Student",
  "Professor",
  "Recruiter",
  "Developer",
  "Customer",
  "Manager",
  "Founder"
];

type TextSegment = {
  start: number;
  end: number;
  text: string;
};

export function EditorShell() {
  const [plainText, setPlainText] = useState("");
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [reader, setReader] = useState<ReaderSimulation | null>(null);
  const [selectedRole, setSelectedRole] = useState("Investor");
  const [busy, setBusy] = useState<"idle" | "analyze" | "rewrite" | "reader">("idle");
  const [error, setError] = useState<string | null>(null);
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(true);
  const [lastCorrectionCount, setLastCorrectionCount] = useState(0);
  const [lastCorrectionMs, setLastCorrectionMs] = useState<number | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);

  const latestTextRef = useRef(plainText);
  const skipDebounceRef = useRef(false);
  const cursorIndexRef = useRef(0);
  const previousSegmentRef = useRef("");
  const correctionIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    latestTextRef.current = plainText;
  }, [plainText]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!autoCorrectEnabled || !plainText.trim()) {
      return;
    }

    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void runAutoCorrection(false);
    }, 320);

    return () => {
      window.clearTimeout(timer);
    };
  }, [plainText, autoCorrectEnabled]);

  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
  const charCount = plainText.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const correctionStatus = useMemo(() => {
    if (!autoCorrectEnabled) return "Gemini auto-correction is off";
    if (!plainText.trim()) return "Start typing to trigger Gemini correction";
    if (isCorrecting) return "Gemini is correcting...";
    if (lastCorrectionCount === 0) return "No corrections in latest pass";
    const latency = lastCorrectionMs ? ` in ${lastCorrectionMs}ms` : "";
    return `Applied ${lastCorrectionCount} correction${lastCorrectionCount === 1 ? "" : "s"}${latency}`;
  }, [autoCorrectEnabled, isCorrecting, lastCorrectionCount, lastCorrectionMs, plainText]);

  async function runAutoCorrection(force: boolean) {
    const snapshot = latestTextRef.current;
    if (!snapshot.trim()) return;

    const segment = pickCorrectionSegment(snapshot, cursorIndexRef.current);
    if (!force && segment.text.trim().length < 3) {
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = correctionIdRef.current + 1;
    correctionIdRef.current = requestId;

    const startedAt = performance.now();
    setIsCorrecting(true);
    setError(null);

    try {
      const result = await liveCorrectText(segment.text, previousSegmentRef.current, controller.signal);
      previousSegmentRef.current = segment.text;

      if (requestId !== correctionIdRef.current) {
        return;
      }

      if (latestTextRef.current !== snapshot) {
        return;
      }

      setLastCorrectionCount(result.corrections);
      setLastCorrectionMs(Math.round(performance.now() - startedAt));

      if (!result.changed || result.corrected_text === segment.text) {
        return;
      }

      const nextText =
        snapshot.slice(0, segment.start) + result.corrected_text + snapshot.slice(segment.end);

      const nextCursor = segment.start + result.corrected_text.length;
      skipDebounceRef.current = true;
      setPlainText(nextText);

      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        if (document.activeElement !== textareaRef.current) return;
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
        cursorIndexRef.current = nextCursor;
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Gemini correction failed");
    } finally {
      if (requestId === correctionIdRef.current) {
        setIsCorrecting(false);
      }
    }
  }

  async function runAnalysis() {
    if (!plainText.trim()) return;

    setError(null);
    setBusy("analyze");

    try {
      const result = await quickAnalyze(plainText);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy("idle");
    }
  }

  async function runRewrite(mode: (typeof rewriteModes)[number]) {
    if (!plainText.trim()) return;

    setError(null);
    setBusy("rewrite");

    try {
      const rewritten = await rewriteContent(plainText, mode);
      skipDebounceRef.current = true;
      setPlainText(rewritten);
      setLastCorrectionCount(0);
      setLastCorrectionMs(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rewrite failed");
    } finally {
      setBusy("idle");
    }
  }

  async function runReaderSimulation() {
    if (!plainText.trim()) return;

    setError(null);
    setBusy("reader");

    try {
      const simulation = await simulateReader(plainText, selectedRole);
      setReader(simulation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reader simulation failed");
    } finally {
      setBusy("idle");
    }
  }

  function onTextChange(value: string, cursorPosition: number) {
    cursorIndexRef.current = cursorPosition;
    setPlainText(value);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="card-glass rounded-2xl p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-sea/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sea">
            Editor Studio
          </span>
          <span className="text-sm text-slate-600">Words: {wordCount}</span>
          <span className="text-sm text-slate-600">Chars: {charCount}</span>
          <span className="text-sm text-slate-600">Read Time: {readTime} min</span>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Live Grammar + Spelling (Gemini)
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Powered by your Gemini API key with low-latency chunk correction.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={autoCorrectEnabled}
                onChange={(event) => setAutoCorrectEnabled(event.target.checked)}
              />
              Enable Auto-correct
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{correctionStatus}</span>
            <button
              onClick={() => void runAutoCorrection(true)}
              disabled={!plainText.trim() || isCorrecting}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:border-sea hover:text-sea disabled:opacity-60"
            >
              {isCorrecting ? (
                <BusyLabel />
              ) : (
                <>
                  <WandSparkles className="h-3.5 w-3.5" />
                  Correct Now
                </>
              )}
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={plainText}
          onChange={(event) => onTextChange(event.target.value, event.target.selectionStart ?? 0)}
          onClick={(event) => {
            cursorIndexRef.current = event.currentTarget.selectionStart ?? 0;
          }}
          onKeyUp={(event) => {
            cursorIndexRef.current = event.currentTarget.selectionStart ?? 0;
          }}
          placeholder="Type your draft here. Gemini will correct spelling and grammar while you type."
          className="h-[420px] w-full rounded-xl border border-slate-200 bg-white p-4 text-base leading-7 text-slate-800"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={runAnalysis}
            disabled={busy !== "idle"}
            className="rounded-xl bg-sea px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "analyze" ? <BusyLabel /> : "Analyze Draft"}
          </button>

          {rewriteModes.map((mode) => (
            <button
              key={mode}
              onClick={() => runRewrite(mode)}
              disabled={busy !== "idle"}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-sea hover:text-sea disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <ScoreCard label="Overall" value={report?.overall_score ?? 0} />
          <ScoreCard label="Clarity" value={report?.clarity_score ?? 0} />
          <ScoreCard label="Grammar" value={report?.grammar_score ?? 0} />
          <ScoreCard label="Logic" value={report?.logic_score ?? 0} />
        </div>

        <section className="card-glass rounded-2xl p-5">
          <h3 className="font-[var(--font-heading)] text-lg font-semibold">Feedback Loop</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {(report?.recommendations || [
              "Run analysis to see personalized improvement recommendations.",
              "Use rewrite modes to compare variants and keep the strongest draft."
            ]).map((item) => (
              <li key={item} className="rounded-lg bg-white/70 p-2">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="card-glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-[var(--font-heading)] text-lg font-semibold">Reader Simulation</h3>
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              {readerRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              onClick={runReaderSimulation}
              disabled={busy !== "idle"}
              className="ml-auto rounded-lg bg-amber px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "reader" ? <BusyLabel /> : "Simulate"}
            </button>
          </div>

          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <OutputList title="Questions" items={reader?.questions} />
            <OutputList title="Confusions" items={reader?.confusions} />
            <OutputList title="Objections" items={reader?.objections} />
            <OutputList title="Suggestions" items={reader?.suggestions} />
          </div>
        </section>
      </aside>
    </div>
  );
}

function OutputList({ title, items }: { title: string; items?: string[] }) {
  return (
    <div className="rounded-lg bg-white/70 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <ul className="mt-1 space-y-1">
        {(items && items.length > 0 ? items : ["No output yet."]).map((item) => (
          <li key={`${title}-${item.slice(0, 32)}`} className="text-sm">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BusyLabel() {
  return (
    <span className="inline-flex items-center gap-1">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      Working
    </span>
  );
}

function pickCorrectionSegment(text: string, cursorIndex: number): TextSegment {
  if (text.length <= 2200) {
    return { start: 0, end: text.length, text };
  }

  const cursor = clamp(cursorIndex, 0, text.length);
  let start = Math.max(0, cursor - 950);
  let end = Math.min(text.length, cursor + 950);

  const beforeBreak = text.lastIndexOf("\n", start);
  if (beforeBreak !== -1 && cursor - beforeBreak < 1400) {
    start = beforeBreak + 1;
  }

  const afterBreak = text.indexOf("\n", end);
  if (afterBreak !== -1 && afterBreak - cursor < 1400) {
    end = afterBreak;
  }

  return {
    start,
    end,
    text: text.slice(start, end)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
