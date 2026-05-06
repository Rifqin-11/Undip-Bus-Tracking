export const PUBLIC_SEMI_STATIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
};

export const PRIVATE_SEMI_STATIC_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

export const NO_STORE_CACHE_HEADERS = {
  "Cache-Control": "no-store",
};
