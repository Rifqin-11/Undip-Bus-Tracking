"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FavoritesRow = {
  favorite_haltes: string[] | null;
  favorite_buggies: string[] | null;
};

type UseFavoritesReturn = {
  /** Set ID halte favorit (lookup O(1)). Empty saat guest atau belum loaded. */
  favoriteHaltes: Set<string>;
  /** Set ID buggy favorit (lookup O(1)). Empty saat guest atau belum loaded. */
  favoriteBuggies: Set<string>;
  /** True ketika fetch awal selesai (atau guest \u2192 langsung true). */
  ready: boolean;
  /** True jika user sudah login (akses ke fitur favorit). */
  canFavorite: boolean;
  isFavoriteHalte: (halteId: string) => boolean;
  isFavoriteBuggy: (buggyId: string) => boolean;
  /** Toggle halte favorit (optimistic). Resolves true jika berhasil. */
  toggleHalte: (halteId: string) => Promise<boolean>;
  /** Toggle buggy favorit (optimistic). Resolves true jika berhasil. */
  toggleBuggy: (buggyId: string) => Promise<boolean>;
};

/**
 * Mengelola halte & buggy favorit milik user yang sudah login.
 * Dipersist di kolom `accounts.favorite_haltes` & `accounts.favorite_buggies`
 * (lihat migration 004) sehingga sinkron lintas device.
 *
 * Untuk guest user: set selalu kosong, toggle langsung resolve `false`.
 */
export function useFavorites(): UseFavoritesReturn {
  const [favoriteHaltes, setFavoriteHaltes] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoriteBuggies, setFavoriteBuggies] = useState<Set<string>>(
    () => new Set(),
  );
  const [ready, setReady] = useState(false);
  const [canFavorite, setCanFavorite] = useState(false);
  const userIdRef = useRef<string | null>(null);

  // ── Fetch favorites untuk user aktif ──────────────────────────────────────
  const fetchFavorites = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      userIdRef.current = null;
      setFavoriteHaltes(new Set());
      setFavoriteBuggies(new Set());
      setCanFavorite(false);
      setReady(true);
      return;
    }

    userIdRef.current = user.id;
    setCanFavorite(true);

    const { data, error } = await supabase
      .from("accounts")
      .select("favorite_haltes, favorite_buggies")
      .eq("id", user.id)
      .single<FavoritesRow>();

    if (error) {
      // Graceful fallback: set kosong, tetap mark ready agar UI tidak blocked.
      setFavoriteHaltes(new Set());
      setFavoriteBuggies(new Set());
    } else {
      setFavoriteHaltes(new Set(data?.favorite_haltes ?? []));
      setFavoriteBuggies(new Set(data?.favorite_buggies ?? []));
    }
    setReady(true);
  }, []);

  // ── Subscribe ke auth state changes ───────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    // Defer initial fetch ke microtask agar setState pertama tidak terjadi
    // sinkron di body effect (cascading render).
    queueMicrotask(() => {
      if (!mounted) return;
      void fetchFavorites();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || !session?.user) {
        // `ready` sudah true sejak fetch awal; tidak perlu di-set ulang.
        userIdRef.current = null;
        setFavoriteHaltes(new Set());
        setFavoriteBuggies(new Set());
        setCanFavorite(false);
        return;
      }
      void fetchFavorites();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchFavorites]);

  // ── Generic toggle helper dengan optimistic update + rollback ─────────────
  const toggleSet = useCallback(
    async (kind: "halte" | "buggy", id: string): Promise<boolean> => {
      const userId = userIdRef.current;
      if (!userId) return false;

      const isHalte = kind === "halte";
      const setterState = isHalte ? setFavoriteHaltes : setFavoriteBuggies;
      const column = isHalte ? "favorite_haltes" : "favorite_buggies";

      // Snapshot untuk rollback
      let snapshot: Set<string> = new Set();
      let nextArray: string[] = [];
      setterState((prev) => {
        snapshot = prev;
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        nextArray = Array.from(next);
        return next;
      });

      const supabase = createClient();
      const { error } = await supabase
        .from("accounts")
        .update({ [column]: nextArray })
        .eq("id", userId);

      if (error) {
        // Rollback
        setterState(snapshot);
        return false;
      }
      return true;
    },
    [],
  );

  const toggleHalte = useCallback(
    (halteId: string) => toggleSet("halte", halteId),
    [toggleSet],
  );
  const toggleBuggy = useCallback(
    (buggyId: string) => toggleSet("buggy", buggyId),
    [toggleSet],
  );

  const isFavoriteHalte = useCallback(
    (halteId: string) => favoriteHaltes.has(halteId),
    [favoriteHaltes],
  );
  const isFavoriteBuggy = useCallback(
    (buggyId: string) => favoriteBuggies.has(buggyId),
    [favoriteBuggies],
  );

  return {
    favoriteHaltes,
    favoriteBuggies,
    ready,
    canFavorite,
    isFavoriteHalte,
    isFavoriteBuggy,
    toggleHalte,
    toggleBuggy,
  };
}
