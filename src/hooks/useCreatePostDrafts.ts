import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_PREFIX = "drafts:create-post:";
const MAX_DRAFTS = 10;
const SAVE_DEBOUNCE_MS = 300;

export interface DraftImageSnapshot {
  uri: string;
  mimeType: string;
  fileName: string;
  width: number | null;
  height: number | null;
}

export interface PostDraft {
  id: string;
  body: string;
  tags: string[];
  image: DraftImageSnapshot | null;
  updatedAt: number;
}

export interface DraftPayload {
  body: string;
  tags: string[];
  image: DraftImageSnapshot | null;
}

interface UseCreatePostDraftsResult {
  drafts: PostDraft[];
  isHydrated: boolean;
  saveCurrent: (draftId: string, payload: DraftPayload) => void;
  commitCurrent: (draftId: string, payload: DraftPayload) => Promise<void>;
  removeDraft: (draftId: string) => Promise<void>;
  loadDraft: (draftId: string) => PostDraft | null;
  clearCurrent: (draftId: string) => Promise<void>;
}

function isDraftLike(value: unknown): value is PostDraft {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PostDraft>;
  return (
    typeof v.id === "string" &&
    typeof v.body === "string" &&
    Array.isArray(v.tags) &&
    typeof v.updatedAt === "number"
  );
}

function isDraftEmpty(payload: DraftPayload): boolean {
  return (
    payload.body.trim().length === 0 &&
    payload.tags.length === 0 &&
    payload.image === null
  );
}

export function useCreatePostDrafts(
  userId: string | null,
): UseCreatePostDraftsResult {
  const [drafts, setDrafts] = useState<PostDraft[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const draftsRef = useRef<PostDraft[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  draftsRef.current = drafts;

  const persist = useCallback(
    async (next: PostDraft[]): Promise<void> => {
      if (!userId) return;
      await AsyncStorage.setItem(
        STORAGE_KEY_PREFIX + userId,
        JSON.stringify(next),
      );
    },
    [userId],
  );

  useEffect(() => {
    setIsHydrated(false);
    if (!userId) {
      setDrafts([]);
      setIsHydrated(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + userId);
        if (cancelled) return;
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setDrafts(parsed.filter(isDraftLike));
            return;
          }
        }
        if (!cancelled) setDrafts([]);
      } catch {
        if (!cancelled) setDrafts([]);
        /* ignore corrupt cache */
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const saveCurrent = useCallback(
    (draftId: string, payload: DraftPayload): void => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing = draftsRef.current;
        const empty = isDraftEmpty(payload);

        if (empty) {
          const filtered = existing.filter((d) => d.id !== draftId);
          if (filtered.length === existing.length) return;
          setDrafts(filtered);
          void persist(filtered);
          return;
        }

        const nextDraft: PostDraft = {
          id: draftId,
          body: payload.body,
          tags: payload.tags,
          image: payload.image,
          updatedAt: Date.now(),
        };
        const next = [
          nextDraft,
          ...existing.filter((d) => d.id !== draftId),
        ].slice(0, MAX_DRAFTS);
        setDrafts(next);
        void persist(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  const commitCurrent = useCallback(
    async (draftId: string, payload: DraftPayload): Promise<void> => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const existing = draftsRef.current;
      if (isDraftEmpty(payload)) {
        const filtered = existing.filter((d) => d.id !== draftId);
        if (filtered.length === existing.length) return;
        setDrafts(filtered);
        await persist(filtered);
        return;
      }
      const nextDraft: PostDraft = {
        id: draftId,
        body: payload.body,
        tags: payload.tags,
        image: payload.image,
        updatedAt: Date.now(),
      };
      const next = [
        nextDraft,
        ...existing.filter((d) => d.id !== draftId),
      ].slice(0, MAX_DRAFTS);
      setDrafts(next);
      await persist(next);
    },
    [persist],
  );

  const removeDraft = useCallback(
    async (draftId: string): Promise<void> => {
      const next = draftsRef.current.filter((d) => d.id !== draftId);
      setDrafts(next);
      await persist(next);
    },
    [persist],
  );

  const loadDraft = useCallback((draftId: string): PostDraft | null => {
    return draftsRef.current.find((d) => d.id === draftId) ?? null;
  }, []);

  const clearCurrent = useCallback(
    async (draftId: string): Promise<void> => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await removeDraft(draftId);
    },
    [removeDraft],
  );

  return {
    drafts,
    isHydrated,
    saveCurrent,
    commitCurrent,
    removeDraft,
    loadDraft,
    clearCurrent,
  };
}
