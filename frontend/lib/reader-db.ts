import { DBSchema, IDBPDatabase, openDB } from "idb";

export type ReaderTheme = "light" | "sepia" | "dark";
export type ReaderFontSize = "S" | "M" | "L" | "XL";

export type StoredBookRecord = {
  id: string;
  title: string;
  author: string;
  filename: string;
  extension: string;
  size_bytes: number;
  file_blob: Blob;
  uploaded_at: string;
  opened_at: string | null;
  progress: number;
  position: string;
  ai_context: string;
  sections: Array<{ label: string; content: string }>;
};

export type ReaderPrefsRecord = {
  id: "reader_prefs";
  theme: ReaderTheme;
  font_size: ReaderFontSize;
};

export type ReadingSessionRecord = {
  id: string;
  book_id: string;
  book_title: string;
  started_at_ms: number;
  ended_at_ms: number;
  duration_ms: number;
  start_progress: number;
  end_progress: number;
  progress_delta: number;
};

type ReaderDatabase = DBSchema & {
  books: {
    key: string;
    value: StoredBookRecord;
  };
  reader_meta: {
    key: string;
    value: ReaderPrefsRecord;
  };
  reading_sessions: {
    key: string;
    value: ReadingSessionRecord;
    indexes: {
      by_ended_at_ms: number;
      by_book_id: string;
    };
  };
};

const DB_NAME = "writerloop-reader";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ReaderDatabase>> | null = null;

function getDb(): Promise<IDBPDatabase<ReaderDatabase>> {
  if (!dbPromise) {
    dbPromise = openDB<ReaderDatabase>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("books")) {
          db.createObjectStore("books", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("reader_meta")) {
          db.createObjectStore("reader_meta", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("reading_sessions")) {
          const store = db.createObjectStore("reading_sessions", { keyPath: "id" });
          store.createIndex("by_ended_at_ms", "ended_at_ms");
          store.createIndex("by_book_id", "book_id");
        }
      }
    });
  }
  return dbPromise;
}

export async function saveBook(record: StoredBookRecord): Promise<void> {
  const db = await getDb();
  await db.put("books", record);
}

export async function getAllBooks(): Promise<StoredBookRecord[]> {
  const db = await getDb();
  const rows = await db.getAll("books");
  return rows.sort((a, b) => {
    const aTime = a.opened_at ? Date.parse(a.opened_at) : Date.parse(a.uploaded_at);
    const bTime = b.opened_at ? Date.parse(b.opened_at) : Date.parse(b.uploaded_at);
    return bTime - aTime;
  });
}

export async function getBookById(id: string): Promise<StoredBookRecord | undefined> {
  const db = await getDb();
  return db.get("books", id);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("books", id);
}

export async function updateBookProgress(
  id: string,
  progress: number,
  position: string,
  openedAt: string = new Date().toISOString()
): Promise<void> {
  const db = await getDb();
  const book = await db.get("books", id);
  if (!book) return;
  book.progress = Math.max(0, Math.min(100, progress));
  book.position = position;
  book.opened_at = openedAt;
  await db.put("books", book);
}

export async function getReaderPrefs(): Promise<ReaderPrefsRecord> {
  const db = await getDb();
  const saved = await db.get("reader_meta", "reader_prefs");
  if (saved) return saved;
  const defaults: ReaderPrefsRecord = {
    id: "reader_prefs",
    theme: "sepia",
    font_size: "M"
  };
  await db.put("reader_meta", defaults);
  return defaults;
}

export async function saveReaderPrefs(theme: ReaderTheme, fontSize: ReaderFontSize): Promise<void> {
  const db = await getDb();
  await db.put("reader_meta", {
    id: "reader_prefs",
    theme,
    font_size: fontSize
  });
}

export async function saveReadingSession(record: ReadingSessionRecord): Promise<void> {
  const db = await getDb();
  await db.put("reading_sessions", record);
}

export async function getReadingSessionsSince(sinceEpochMs: number): Promise<ReadingSessionRecord[]> {
  const db = await getDb();
  const tx = db.transaction("reading_sessions", "readonly");
  const index = tx.store.index("by_ended_at_ms");
  const rows = await index.getAll(IDBKeyRange.lowerBound(Math.max(0, sinceEpochMs)));
  await tx.done;
  return rows.sort((a, b) => a.ended_at_ms - b.ended_at_ms);
}
