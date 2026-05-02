import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_PREFIX = "create-post:recent-tags:";
const MAX_RECENT_TAGS = 8;

interface UseRecentTagsResult {
  recentTags: string[];
  recordTag: (tag: string) => void;
}

export function useRecentTags(userId: string | null): UseRecentTagsResult {
  const [recentTags, setRecentTags] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setRecentTags([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + userId);
        if (cancelled || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentTags(parsed.filter((t): t is string => typeof t === "string"));
        }
      } catch {
        /* ignore corrupt cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const recordTag = useCallback(
    (tag: string): void => {
      if (!userId || !tag) return;
      setRecentTags((current) => {
        const next = [tag, ...current.filter((t) => t !== tag)].slice(
          0,
          MAX_RECENT_TAGS,
        );
        void AsyncStorage.setItem(
          STORAGE_KEY_PREFIX + userId,
          JSON.stringify(next),
        );
        return next;
      });
    },
    [userId],
  );

  return { recentTags, recordTag };
}
