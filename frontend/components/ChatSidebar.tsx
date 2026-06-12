import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Copy, Download, Loader2, MessageSquarePlus, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { type Book } from '@/lib/db';
import { cn } from '@/lib/utils';
import { chatDocumentWithGemini, explainImageWithGemini, explainSelectionWithGemini } from '@/lib/api';
import { getThemeStyles, type Theme } from './reader/readerUtils';
import {
  type ChatStore,
  type Message,
  type TokenUsage,
  createSession,
  estimateTokens,
  exportChat,
  loadChatStore,
  makeMessage,
  persistChatStore,
  summarizeSessionTitle,
} from './chat/chatSupport';

interface ChatSidebarProps {
  book: Book;
  currentTextContext: string;
  quotedText?: string | null;
  selectedImage?: { url: string; alt?: string | null } | null;
  autoExplainNonce?: number;
  onClearQuote?: () => void;
  onClose: () => void;
  theme: Theme;
}

interface MessageActionButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

const EMPTY_USAGE: TokenUsage = {
  contextTokens: 0,
  responseTokens: 0,
  totalTokens: 0,
  updatedAt: 0,
};

const DEFAULT_CONTEXT_WINDOW = 12;
const CONTEXT_WINDOW_OPTIONS = [8, 12, 20] as const;

function MessageActionButton({ label, onClick, className, children }: MessageActionButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative p-1.5 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm group/action',
        className,
      )}
    >
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-200 group-hover/action:opacity-100">
        {label}
      </span>
    </button>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'AI request failed. Please try again.';
}

function formatSelectionExplanation(payload: {
  concise_explanation: string;
  definition: string;
  meaning_in_context: string;
  usage_examples: string[];
  detected_language: string;
  translation_to_english: string;
  math_interpretation: string;
  math_solution: string;
}) {
  const examples = payload.usage_examples.filter(Boolean);
  const exampleBlock = examples.length > 0 ? `\n\n**Examples**\n${examples.map((item) => `- ${item}`).join('\n')}` : '';
  const translationBlock = payload.translation_to_english?.trim()
    ? `\n\n**Translation (English)**\n${payload.translation_to_english.trim()}`
    : '';
  const languageBlock = payload.detected_language?.trim()
    ? `\n\n**Detected Language**\n${payload.detected_language.trim()}`
    : '';
  const mathInterpretationBlock = payload.math_interpretation?.trim()
    ? `\n\n**Math Interpretation**\n${payload.math_interpretation.trim()}`
    : '';
  const mathSolutionBlock = payload.math_solution?.trim()
    ? `\n\n**Math Solution**\n${payload.math_solution.trim()}`
    : '';
  return [
    '**Quick Explanation**',
    payload.concise_explanation,
    '',
    '**Definition**',
    payload.definition,
    '',
    '**Meaning In Context**',
    payload.meaning_in_context,
    exampleBlock,
    languageBlock,
    translationBlock,
    mathInterpretationBlock,
    mathSolutionBlock,
  ].join('\n').trim();
}

function formatImageExplanation(payload: { concise_explanation: string; key_points: string[]; detected_language: string; translated_text: string; math_solution: string }) {
  const points = payload.key_points.filter(Boolean);
  const pointsBlock = points.length > 0 ? `\n\n**Key Points**\n${points.map((item) => `- ${item}`).join('\n')}` : '';
  const languageBlock = payload.detected_language?.trim()
    ? `\n\n**Detected Language**\n${payload.detected_language.trim()}`
    : '';
  const translationBlock = payload.translated_text?.trim()
    ? `\n\n**Translated Text (English)**\n${payload.translated_text.trim()}`
    : '';
  const mathSolutionBlock = payload.math_solution?.trim()
    ? `\n\n**Math Solution**\n${payload.math_solution.trim()}`
    : '';
  return `**Image Explanation**\n${payload.concise_explanation}${pointsBlock}${languageBlock}${translationBlock}${mathSolutionBlock}`;
}

export function ChatSidebar({
  book,
  currentTextContext,
  quotedText,
  selectedImage,
  autoExplainNonce,
  onClearQuote,
  onClose,
  theme,
}: ChatSidebarProps) {
  const [chatStore, setChatStore] = useState<ChatStore>(() => loadChatStore(book.id, book.title));
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [contextWindowSize, setContextWindowSize] = useState<number>(DEFAULT_CONTEXT_WINDOW);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const lastAutoExplainNonceRef = useRef(0);

  const styles = getThemeStyles(theme);
  const isDark = theme === 'dark';

  const activeSession = useMemo(
    () => chatStore.sessions.find((session) => session.id === chatStore.activeSessionId) ?? chatStore.sessions[0],
    [chatStore.activeSessionId, chatStore.sessions],
  );
  const messages: Message[] = activeSession?.messages ?? [];
  const tokenUsage = chatStore.usageBySession[activeSession?.id ?? ''] ?? EMPTY_USAGE;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    persistChatStore(book.id, chatStore);
  }, [book.id, chatStore]);

  useEffect(() => {
    setChatStore(loadChatStore(book.id, book.title));
    setEditingMessageId(null);
    setEditingDraft('');
    setInput('');
    setCopyHint(null);
    setLoading(false);
    lastAutoExplainNonceRef.current = 0;
  }, [book.id, book.title]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!copyHint) return;
    const timer = window.setTimeout(() => setCopyHint(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copyHint]);

  const updateActiveSession = useCallback((updater: (session: Message[]) => Message[]) => {
    setChatStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => {
        if (session.id !== prev.activeSessionId) return session;
        const nextMessages = updater(session.messages);
        return {
          ...session,
          messages: nextMessages,
          updatedAt: Date.now(),
        };
      }),
    }));
  }, []);

  const appendTokenUsage = useCallback((contextTokens: number, responseTokens: number) => {
    setChatStore((prev) => {
      const sessionId = prev.activeSessionId;
      const prevUsage = prev.usageBySession[sessionId] ?? EMPTY_USAGE;
      const nextContext = Math.max(0, prevUsage.contextTokens + contextTokens);
      const nextResponse = Math.max(0, prevUsage.responseTokens + responseTokens);
      return {
        ...prev,
        usageBySession: {
          ...prev.usageBySession,
          [sessionId]: {
            contextTokens: nextContext,
            responseTokens: nextResponse,
            totalTokens: nextContext + nextResponse,
            updatedAt: Date.now(),
          },
        },
      };
    });
  }, []);

  const buildSnippets = useCallback(() => {
    const snippets: string[] = [];

    if (quotedText?.trim()) snippets.push(quotedText.trim());
    if (currentTextContext?.trim()) snippets.push(currentTextContext.trim().slice(0, 7000));
    if (selectedImage?.alt?.trim()) snippets.push(`Image alt/context: ${selectedImage.alt.trim()}`);

    return snippets.filter(Boolean).slice(0, 4);
  }, [currentTextContext, quotedText, selectedImage?.alt]);

  const handleCopyMessage = useCallback(async (text: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API not available');
      await navigator.clipboard.writeText(text);
      setCopyHint('Copied');
    } catch {
      setCopyHint('Copy failed');
    }
  }, []);

  const handleEditAsNextQuestion = useCallback((text: string) => {
    setInput(text);
    setEditingMessageId(null);
    setEditingDraft('');
  }, []);

  const handleNewSession = useCallback(() => {
    const session = createSession(book.title);
    setChatStore((prev) => ({
      ...prev,
      activeSessionId: session.id,
      sessions: [session, ...prev.sessions],
    }));
    setEditingMessageId(null);
    setEditingDraft('');
    setInput('');
  }, [book.title]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    setChatStore((prev) => {
      if (prev.sessions.length <= 1) {
        const fallback = createSession(book.title);
        return { activeSessionId: fallback.id, sessions: [fallback], usageBySession: {} };
      }

      const remaining = prev.sessions.filter((session) => session.id !== sessionId);
      const nextActiveSessionId = prev.activeSessionId === sessionId ? remaining[0].id : prev.activeSessionId;
      const { [sessionId]: _removedUsage, ...restUsage } = prev.usageBySession;
      return {
        ...prev,
        activeSessionId: nextActiveSessionId,
        sessions: remaining,
        usageBySession: restUsage,
      };
    });
  }, [book.title]);

  const runSelectionExplain = useCallback(async () => {
    if (!activeSession) return;
    if (!quotedText && !selectedImage) return;

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLoading(true);

    try {
      const snippets = buildSnippets();
      const contextTokens = estimateTokens(snippets.join('\n\n'));

      if (selectedImage?.url) {
        const userMessage = makeMessage(
          'user',
          `> [Selected image${selectedImage.alt ? `: ${selectedImage.alt}` : ''}]\n\nExplain this image clearly.`,
        );
        updateActiveSession((prev) => [...prev, userMessage]);

        const imageExplanation = await explainImageWithGemini(
          selectedImage.url,
          'Explain this selected image, translate any non-English text, and solve any math shown.',
          currentTextContext,
        );

        const responseText = formatImageExplanation(imageExplanation);
        updateActiveSession((prev) => [...prev, makeMessage('model', responseText)]);
        appendTokenUsage(contextTokens, estimateTokens(responseText));
      } else if (quotedText?.trim()) {
        const cleanQuote = quotedText.trim();
        const userMessage = makeMessage('user', `> ${cleanQuote}\n\nExplain this selection. Translate if needed. Solve math if present.`);
        updateActiveSession((prev) => [...prev, userMessage]);

        const explained = await explainSelectionWithGemini(cleanQuote, currentTextContext);
        const responseText = formatSelectionExplanation(explained);
        updateActiveSession((prev) => [...prev, makeMessage('model', responseText)]);
        appendTokenUsage(contextTokens, estimateTokens(responseText));
      }

      onClearQuote?.();
    } catch (error) {
      updateActiveSession((prev) => [...prev, makeMessage('model', toErrorMessage(error))]);
    } finally {
      setLoading(false);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [
    activeSession,
    appendTokenUsage,
    buildSnippets,
    currentTextContext,
    onClearQuote,
    quotedText,
    selectedImage,
    updateActiveSession,
  ]);

  const handleSend = useCallback(async () => {
    if (!activeSession || loading) return;

    const question = input.trim();
    if (!question && !quotedText && !selectedImage) return;

    if (!question && (quotedText || selectedImage)) {
      await runSelectionExplain();
      return;
    }

    const snippets = buildSnippets();
    const userPayload = quotedText?.trim() ? `> ${quotedText.trim()}\n\n${question}` : question;
    const nextUserMessage = makeMessage('user', userPayload);

    setChatStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => {
        if (session.id !== prev.activeSessionId) return session;
        const shouldRename = session.title === 'New chat' || session.title === 'Legacy chat';
        return {
          ...session,
          title: shouldRename ? summarizeSessionTitle(question || quotedText || selectedImage?.alt || '') : session.title,
          messages: [...session.messages, nextUserMessage],
          updatedAt: Date.now(),
        };
      }),
    }));

    setInput('');
    setLoading(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const response = await chatDocumentWithGemini(question, snippets, book.title);
      const answer = response.answer?.trim() || 'No response from AI.';
      updateActiveSession((prev) => [...prev, makeMessage('model', answer)]);
      appendTokenUsage(estimateTokens([question, ...snippets].join('\n')), estimateTokens(answer));
      onClearQuote?.();
    } catch (error) {
      updateActiveSession((prev) => [...prev, makeMessage('model', toErrorMessage(error))]);
    } finally {
      setLoading(false);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [
    activeSession,
    appendTokenUsage,
    book.title,
    buildSnippets,
    input,
    loading,
    onClearQuote,
    quotedText,
    runSelectionExplain,
    selectedImage,
    updateActiveSession,
  ]);

  useEffect(() => {
    const nonce = autoExplainNonce ?? 0;
    if (nonce <= lastAutoExplainNonceRef.current) return;
    if (!quotedText && !selectedImage) {
      lastAutoExplainNonceRef.current = nonce;
      return;
    }
    if (loading) return;

    lastAutoExplainNonceRef.current = nonce;
    void runSelectionExplain();
  }, [autoExplainNonce, loading, quotedText, runSelectionExplain, selectedImage]);

  const formatSessionTime = (timestamp: number) => {
    const delta = Date.now() - timestamp;
    if (delta < 60_000) return 'Just now';
    if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))}m ago`;
    if (delta < 86_400_000) return `${Math.max(1, Math.floor(delta / 3_600_000))}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className={cn('flex flex-col h-full border-l transition-colors duration-300', styles.bg, styles.text, styles.sidebarBorder)}>
      <div className={cn('p-4 border-b flex justify-between items-center bg-opacity-50 backdrop-blur-sm', styles.divider)}>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand-orange" />
          <h2 className="font-serif font-bold">AI Assistant</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportChat(book, messages)} className={cn('p-1.5 rounded-full transition-colors', styles.toolbarHoverBg)} title="Export chat (JSON + Markdown)"><Download className="w-4.5 h-4.5" /></button>
          <button onClick={onClose} className={cn('p-1 rounded-full transition-colors', styles.toolbarHoverBg)}><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className={cn('px-4 py-3 border-b space-y-2', styles.divider, styles.noteCardBg)}>
        <div className="flex items-center justify-between gap-2">
          <div className={cn('text-xs font-medium truncate', styles.subtleText)}>{activeSession?.title || 'New chat'}</div>
          <button onClick={handleNewSession} className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors', styles.inputBorder, styles.toolbarHoverBg)}>
            <Plus className="w-3.5 h-3.5" />
            New chat
          </button>
        </div>

        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {chatStore.sessions.map((session) => {
            const isActive = session.id === chatStore.activeSessionId;
            return (
              <div
                key={session.id}
                className={cn(
                  'group/session rounded-lg border transition-all px-2 py-1.5',
                  isActive ? 'bg-brand-orange/10 border-brand-orange/40' : cn(styles.inputBorder, styles.toolbarHoverBg),
                )}
              >
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setChatStore((prev) => ({ ...prev, activeSessionId: session.id }))}
                    className={cn('min-w-0 flex-1 truncate text-xs text-left px-1.5 py-0.5 rounded-md', isActive ? 'text-brand-orange font-medium' : styles.subtleText)}
                    title={session.title}
                  >
                    {session.title}
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className={cn('p-1 rounded-md opacity-0 group-hover/session:opacity-100 transition-opacity text-rose-500', styles.toolbarHoverBg)}
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className={cn('mt-1 px-1.5 text-[10px]', styles.subtleText)}>
                  Updated {formatSessionTime(session.updatedAt)}
                </div>
              </div>
            );
          })}
        </div>

        <div className={cn('text-[11px] rounded-lg px-2.5 py-2 border space-y-1.5', styles.inputBorder, styles.inputBg)}>
          <div className="flex items-center justify-between">
            <span className={styles.subtleText}>Token usage (estimate)</span>
            <span className="font-medium">ctx {tokenUsage.contextTokens} · resp {tokenUsage.responseTokens} · total {tokenUsage.totalTokens}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className={styles.subtleText}>Context window</span>
              <select
                value={contextWindowSize}
                onChange={(e) => setContextWindowSize(Number(e.target.value))}
                className={cn('rounded-md border px-1.5 py-0.5 text-[11px]', styles.inputBg, styles.inputBorder)}
              >
                {CONTEXT_WINDOW_OPTIONS.map((size) => <option key={size} value={size}>{size} msgs</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isEditing = editingMessageId === msg.id;
          const isUserMessage = msg.role === 'user';
          return (
            <div key={msg.id} className={cn('group/message flex gap-3 items-start', isUserMessage ? 'flex-row-reverse' : 'flex-row')}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold shadow-sm ring-1 ring-black/5',
                isUserMessage ? 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700' : 'bg-gradient-to-br from-brand-orange to-orange-500 text-white',
              )}>
                {isUserMessage ? 'You' : <Bot className="w-4.5 h-4.5" />}
              </div>
              <div className={cn(
                'p-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed border shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-all duration-200',
                isUserMessage ? cn(styles.toolbarGroupBg, 'border-transparent') : cn(styles.noteCardBg, styles.divider, 'border'),
              )}>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea value={editingDraft} onChange={(e) => setEditingDraft(e.target.value)} rows={4} className="w-full rounded-md border px-2 py-1 text-sm" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingMessageId(null)} className={cn('text-xs px-2 py-1 rounded-md', styles.toolbarHoverBg)}>Cancel</button>
                      <button
                        onClick={() => {
                          const nextText = editingDraft.trim() || msg.text;
                          if (isUserMessage) handleEditAsNextQuestion(nextText);
                          updateActiveSession((prev) => prev.map((m) => (m.id === msg.id ? { ...m, text: nextText, updatedAt: Date.now() } : m)));
                          setEditingMessageId(null);
                        }}
                        className="text-xs px-2 py-1 rounded-md bg-brand-orange text-white"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={cn('prose prose-sm max-w-none', isDark ? 'prose-invert' : '')}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                    <div className={cn(
                      'mt-2 flex justify-end gap-1 opacity-0 translate-y-1 transition-all duration-200 group-hover/message:opacity-100 group-hover/message:translate-y-0',
                      isEditing ? 'opacity-100 translate-y-0' : '',
                    )}>
                      <MessageActionButton onClick={() => void handleCopyMessage(msg.text)} label="Copy" className={cn(styles.toolbarHoverBg, styles.subtleText)}>
                        <Copy className="w-3.5 h-3.5" />
                      </MessageActionButton>
                      <MessageActionButton onClick={() => { setEditingMessageId(msg.id); setEditingDraft(msg.text); }} label="Edit" className={cn(styles.toolbarHoverBg, styles.subtleText)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </MessageActionButton>
                      {isUserMessage && (
                        <MessageActionButton onClick={() => handleEditAsNextQuestion(msg.text)} label="Ask from here" className={cn(styles.toolbarHoverBg, styles.subtleText)}>
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                        </MessageActionButton>
                      )}
                      <MessageActionButton onClick={() => updateActiveSession((prev) => prev.filter((m) => m.id !== msg.id))} label="Delete" className={cn(styles.toolbarHoverBg, 'text-rose-500')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </MessageActionButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-orange text-white grid place-items-center"><Bot className="w-5 h-5" /></div>
            <div className={cn('p-3 rounded-2xl flex items-center gap-2 border', styles.noteCardBg, styles.divider)}>
              <Loader2 className={cn('w-4 h-4 animate-spin', styles.subtleText)} />
              <span className="text-xs opacity-80">Generating response...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={cn('p-4 border-t shrink-0', styles.divider)}>
        {copyHint && <div className={cn('mb-2 text-xs', styles.subtleText)}>{copyHint}</div>}

        {selectedImage?.url && (
          <div className={cn('mb-2 p-2 border-l-2 rounded-r-lg text-xs relative group', 'bg-brand-orange/10 border-brand-orange text-gray-900')}>
            <p className="line-clamp-2 italic opacity-80">Selected image{selectedImage.alt ? `: ${selectedImage.alt}` : ''}</p>
            <button onClick={onClearQuote} className={cn('absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity', styles.toolbarGroupBg, styles.toolbarHoverBg)}><X className="w-3 h-3" /></button>
          </div>
        )}

        {quotedText && (
          <div className={cn('mb-2 p-2 border-l-2 rounded-r-lg text-xs relative group', 'bg-brand-orange/10 border-brand-orange text-gray-900')}>
            <p className="line-clamp-2 italic opacity-80">{quotedText}</p>
            <button onClick={onClearQuote} className={cn('absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity', styles.toolbarGroupBg, styles.toolbarHoverBg)}><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border transition-all', styles.inputBg, styles.inputBorder)}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={quotedText || selectedImage ? 'Ask about the current selection...' : 'Ask about the document...'}
            className={cn('flex-1 bg-transparent border-none outline-none text-sm', styles.inputText, styles.inputPlaceholder)}
          />
          <button onClick={() => void handleSend()} disabled={loading || (!input.trim() && !quotedText && !selectedImage)} className={cn('p-2 rounded-lg transition-colors', (loading || (!input.trim() && !quotedText && !selectedImage)) ? styles.disabledText : cn('text-brand-orange', styles.toolbarHoverBg))}><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
