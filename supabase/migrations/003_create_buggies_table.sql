CREATE TABLE IF NOT EXISTS public.buggies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 8,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.buggies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.buggies
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.buggies
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.buggies
    FOR UPDATE USING (true);
