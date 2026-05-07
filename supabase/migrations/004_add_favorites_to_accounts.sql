-- ============================================================================
-- Add favorites (haltes & buggies) to accounts table
--
-- Memungkinkan user yang sudah login menyimpan halte & buggy favorit
-- yang akan ditampilkan paling atas di list, sinkron lintas device.
-- ============================================================================

-- 1. Tambah kolom array (default empty array, never null)
ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS favorite_haltes TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS favorite_buggies TEXT[] NOT NULL DEFAULT '{}';

-- 2. Index GIN agar query "is favorite" cepat (mis. ANY/contains)
CREATE INDEX IF NOT EXISTS accounts_favorite_haltes_idx
    ON public.accounts USING GIN (favorite_haltes);

CREATE INDEX IF NOT EXISTS accounts_favorite_buggies_idx
    ON public.accounts USING GIN (favorite_buggies);

-- 3. RLS: pastikan user bisa update kolom favorit miliknya sendiri.
--    Dibungkus DO block agar idempotent jika policy serupa sudah ada.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'accounts'
          AND policyname = 'Users can update own favorites'
    ) THEN
        EXECUTE 'CREATE POLICY "Users can update own favorites"
                 ON public.accounts
                 FOR UPDATE
                 USING (auth.uid() = id)
                 WITH CHECK (auth.uid() = id)';
    END IF;
END $$;

COMMENT ON COLUMN public.accounts.favorite_haltes IS
    'Array halte ID (string slug, mis. h_widya_puraya) yang dibintangi user.';
COMMENT ON COLUMN public.accounts.favorite_buggies IS
    'Array buggy ID (uuid string) yang dibintangi user.';
