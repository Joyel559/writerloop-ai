"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Settings, Sparkles, X } from "lucide-react";

import { saveGeminiKey } from "@/lib/api";

export default function HomePage() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmitGeminiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = geminiKey.trim();
    if (!trimmed) {
      setError("Please enter your Gemini API key.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await saveGeminiKey(trimmed);
      setFeedback(response.message);
      setGeminiKey("");
      setIsSetupOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Gemini key.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:py-16">
      <header className="fade-up">
        <div className="inline-flex items-center gap-2 rounded-full bg-sea/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sea">
          <Sparkles className="h-3.5 w-3.5" />
          WriterLoop AI
        </div>
        <h1 className="mt-6 max-w-3xl font-[var(--font-heading)] text-4xl font-bold leading-tight text-ink md:text-6xl">
          Intelligent feedback loops that continuously improve your writing.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-700">
          Use Reader App for Kindle-style document reading with visual layout, highlights, and AI-on-selection.
          Use Editor App for Gemini-powered live correction, analysis, and rewrites.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 transition hover:border-sea hover:text-sea"
            onClick={() => {
              setError(null);
              setFeedback(null);
              setIsSetupOpen(true);
            }}
            title="Gemini API Setup"
            aria-label="Gemini API Setup"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {feedback ? (
          <p className="mt-2 max-w-2xl rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {feedback}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/reader"
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Open Reader <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-xl bg-sea px-5 py-3 font-semibold text-white transition hover:brightness-110"
          >
            Open Editor App <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-sea hover:text-sea"
          >
            View Dashboard
          </Link>
        </div>
      </header>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {[
          {
            title: "Reader App",
            text: "Render files in visual mode with styling/images, then mark text and ask AI on-demand."
          },
          {
            title: "Editor App",
            text: "Type with Gemini live spell+grammar correction, then run analysis and rewrites."
          }
        ].map((item, index) => (
          <article
            key={item.title}
            className="card-glass fade-up rounded-2xl p-5"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <h2 className="font-[var(--font-heading)] text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-700">{item.text}</p>
          </article>
        ))}
      </section>

      {isSetupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-[var(--font-heading)] text-2xl font-semibold text-ink">Gemini API Setup</h2>
              <button
                className="rounded-md border border-slate-300 p-1 text-slate-600 hover:text-slate-900"
                onClick={() => setIsSetupOpen(false)}
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Enter your Gemini key once. WriterLoop applies it immediately and stores it on the backend runtime env file.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Get API key:{" "}
              <a
                href="https://aistudio.google.com/app/api-keys"
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-sea underline underline-offset-2 hover:text-amber"
              >
                https://aistudio.google.com/app/api-keys
              </a>
            </p>

            <form className="mt-4 space-y-3" onSubmit={(event) => void onSubmitGeminiKey(event)}>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="gemini-key-input">
                Gemini API Key
              </label>
              <input
                id="gemini-key-input"
                type="password"
                value={geminiKey}
                onChange={(event) => setGeminiKey(event.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sea focus:ring-2 focus:ring-sea/20"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSetupOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sea px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
