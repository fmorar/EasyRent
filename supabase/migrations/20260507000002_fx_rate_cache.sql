-- ============================================================
-- fx_rate_cache — daily USD/CRC exchange rate cache
--
-- Used by the market analysis pricing engine to convert mixed
-- currencies in scraped comparables. Refreshed lazily — first
-- request of the day fetches and caches; rest of the day reads.
--
-- Sources (in order of preference):
--   1. BCCR "Tipo de cambio de venta" web service
--   2. exchangerate.host fallback
--   3. Manual override (env var FX_USD_CRC_OVERRIDE)
-- ============================================================

CREATE TABLE fx_rate_cache (
  date        DATE         PRIMARY KEY,
  usd_to_crc  NUMERIC(10,4) NOT NULL,
  source      TEXT         NOT NULL,
  fetched_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Anyone authenticated can read; writes happen from server actions.
ALTER TABLE fx_rate_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY fx_rate_cache_read
  ON fx_rate_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY fx_rate_cache_write
  ON fx_rate_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY fx_rate_cache_update
  ON fx_rate_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL);
