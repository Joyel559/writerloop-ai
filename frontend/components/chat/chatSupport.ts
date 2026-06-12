import { type Book } from '@/lib/db';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface TokenUsage {
  contextTokens: number;
  responseTokens: number;
  totalTokens: number;
  updatedAt: number;
}

export interface ChatStore {
  activeSessionId: string;
  sessions: ChatSession[];
  usageBySession: Record<string, TokenUsage>;
}

const CHAT_STORAGE_KEY_PREFIX = 'writerloop.chat.store.v2';
const CHAT_STORAGE_KEY_LEGACY_PREFIX = 'writerloop.chat.messages.v1';
const LEGACY_CONNECT_PROMPT = 'Before we start, open settings and connect your AI API.';

export const makeMsgId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const makeSessionId = () => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const makeMessage = (role: 'user' | 'model', text: string): Message => ({ id: makeMsgId(), role, text, createdAt: Date.now() });

const getChatStorageKey = (bookId: string) => `${CHAT_STORAGE_KEY_PREFIX}:${bookId}`;
const getLegacyChatStorageKey = (bookId: string) => `${CHAT_STORAGE_KEY_LEGACY_PREFIX}:${bookId}`;

function replaceLegacyConnectPrompt(text: string): string {
  const cleaned = text
    .replaceAll(LEGACY_CONNECT_PROMPT, '')
    .replaceAll('Please configure your AI API first. Click settings and fill in Provider, Base URL, Model, and API Key.', '')
    .replaceAll('${FRIENDLY_CONNECT_PROMPT}', '')
    .replaceAll('\n\n\n', '\n\n')
    .trim();

  if (cleaned.includes("Hi! I'm your reading assistant.")) {
    return 'Hi lets read.';
  }
  return cleaned;
}

function initialAssistantMessage(fallbackTitle: string): Message {
  void fallbackTitle;
  return makeMessage('model', 'Hi lets read.');
}

function createDefaultSession(fallbackTitle: string): ChatSession {
  const now = Date.now();
  return {
    id: makeSessionId(),
    title: 'New chat',
    messages: [initialAssistantMessage(fallbackTitle)],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeMessages(input: unknown): Message[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      const msg = m as Partial<Message>;
      if (typeof msg.id !== 'string' || typeof msg.text !== 'string' || (msg.role !== 'user' && msg.role !== 'model')) return null;
      return {
        id: msg.id,
        role: msg.role,
        text: replaceLegacyConnectPrompt(msg.text),
        createdAt: Number(msg.createdAt ?? Date.now()),
        updatedAt: msg.updatedAt ? Number(msg.updatedAt) : undefined,
      } as Message;
    })
    .filter((m): m is Message => Boolean(m));
}

function normalizeSession(input: unknown, fallbackTitle: string): ChatSession | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<ChatSession>;
  if (typeof raw.id !== 'string') return null;
  const messages = normalizeMessages(raw.messages);
  return {
    id: raw.id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'New chat',
    messages: messages.length > 0 ? messages : [initialAssistantMessage(fallbackTitle)],
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
  };
}

function normalizeUsage(input: unknown): Record<string, TokenUsage> {
  if (!input || typeof input !== 'object') return {};
  const output: Record<string, TokenUsage> = {};
  Object.entries(input as Record<string, unknown>).forEach(([sessionId, value]) => {
    if (!value || typeof value !== 'object') return;
    const usage = value as Partial<TokenUsage>;
    output[sessionId] = {
      contextTokens: Math.max(0, Number(usage.contextTokens ?? 0)),
      responseTokens: Math.max(0, Number(usage.responseTokens ?? 0)),
      totalTokens: Math.max(0, Number(usage.totalTokens ?? 0)),
      updatedAt: Number(usage.updatedAt ?? Date.now()),
    };
  });
  return output;
}

export function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function loadChatStore(bookId: string, fallbackTitle: string): ChatStore {
  const createInitial = (): ChatStore => {
    const defaultSession = createDefaultSession(fallbackTitle);
    return {
      activeSessionId: defaultSession.id,
      sessions: [defaultSession],
      usageBySession: {},
    };
  };

  try {
    const raw = window.localStorage.getItem(getChatStorageKey(bookId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatStore>;
      const sessions = Array.isArray(parsed.sessions)
        ? parsed.sessions.map((s) => normalizeSession(s, fallbackTitle)).filter((s): s is ChatSession => Boolean(s))
        : [];
      if (sessions.length === 0) return createInitial();
      const activeSessionId = sessions.some((s) => s.id === parsed.activeSessionId)
        ? (parsed.activeSessionId as string)
        : sessions[0].id;
      const usageBySession = normalizeUsage(parsed.usageBySession);
      return { activeSessionId, sessions, usageBySession };
    }

    const legacyRaw = window.localStorage.getItem(getLegacyChatStorageKey(bookId));
    if (legacyRaw) {
      const messages = normalizeMessages(JSON.parse(legacyRaw));
      const now = Date.now();
      const legacySession: ChatSession = {
        id: makeSessionId(),
        title: 'Legacy chat',
        messages: messages.length > 0 ? messages : [initialAssistantMessage(fallbackTitle)],
        createdAt: now,
        updatedAt: now,
      };
      const migrated: ChatStore = { activeSessionId: legacySession.id, sessions: [legacySession], usageBySession: {} };
      persistChatStore(bookId, migrated);
      window.localStorage.removeItem(getLegacyChatStorageKey(bookId));
      return migrated;
    }
  } catch {
    return createInitial();
  }

  return createInitial();
}

export function persistChatStore(bookId: string, store: ChatStore) {
  window.localStorage.setItem(getChatStorageKey(bookId), JSON.stringify(store));
}

export function createSession(fallbackTitle: string): ChatSession {
  return createDefaultSession(fallbackTitle);
}

export function summarizeSessionTitle(text: string): string {
  const stripped = text.replace(/^>.*$/gm, '').replace(/\s+/g, ' ').trim();
  if (!stripped) return 'New chat';
  return stripped.slice(0, 36);
}

// backward compatibility for existing imports/usages
export function loadChatMessages(bookId: string, fallbackTitle: string): Message[] {
  const store = loadChatStore(bookId, fallbackTitle);
  return store.sessions.find((s) => s.id === store.activeSessionId)?.messages ?? store.sessions[0]?.messages ?? [initialAssistantMessage(fallbackTitle)];
}

export function persistChatMessages(bookId: string, messages: Message[]) {
  const store = loadChatStore(bookId, 'Book');
  const nextSessions = store.sessions.map((s) => (s.id === store.activeSessionId ? { ...s, messages, updatedAt: Date.now() } : s));
  persistChatStore(bookId, { ...store, sessions: nextSessions });
}

export function exportChat(book: Book, messages: Message[]) {
  const payload = { bookId: book.id, bookTitle: book.title, exportedAt: new Date().toISOString(), messages };
  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonA = document.createElement('a');
  jsonA.href = jsonUrl;
  jsonA.download = `writerloop-chat-${book.id}.json`;
  jsonA.click();
  URL.revokeObjectURL(jsonUrl);

  const mdLines = ['# Chat Export', '', `- Book: ${book.title}`, `- Book ID: ${book.id}`, `- Exported At: ${new Date().toISOString()}`, '', ...messages.flatMap((m, i) => [`## ${i + 1}. ${m.role === 'user' ? 'User' : 'Assistant'}`, '', m.text, ''])];
  const mdBlob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const mdUrl = URL.createObjectURL(mdBlob);
  const mdA = document.createElement('a');
  mdA.href = mdUrl;
  mdA.download = `writerloop-chat-${book.id}.md`;
  mdA.click();
  URL.revokeObjectURL(mdUrl);
}
