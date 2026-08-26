-- ============================================================
-- 0036_chatbot_provider_flexibility.sql — any OpenAI-compatible vendor
-- ------------------------------------------------------------
-- 0035 hardcoded chatbot_settings.provider to ('grok','claude'), each with
-- its own bespoke wire-format translation in lib/chatbot/provider.ts. The
-- client roster isn't fixed to those two — a consultancy might do better on
-- OpenAI/ChatGPT, Gemini, DeepSeek, a self-hosted endpoint, whatever suits
-- their budget and region.
--
-- Nearly every LLM API other than Anthropic's now speaks the same OpenAI
-- chat-completions wire format — including Google's Gemini, via its own
-- /v1beta/openai/ compatibility endpoint — so instead of a bespoke
-- integration per vendor, chatbot_settings.provider now stores a WIRE
-- FORMAT FAMILY ('openai_compatible' | 'claude'), plus a base_url + model
-- the Super Admin sets per org. 'openai_compatible' works for any vendor
-- speaking that format (OpenAI, Grok, Gemini, DeepSeek, Groq, a proxy,
-- anything); 'claude' stays the one true outlier with its own native
-- integration.
--
-- Existing 'grok' rows (if any were saved while the UI only offered
-- Grok/Claude) are rewritten in place to the equivalent openai_compatible
-- config so nothing already configured silently breaks.
--
-- SAFE ON A LIVE TABLE: additive columns + a constraint swap. At most one
-- test row exists in this table today.
-- ============================================================

alter table chatbot_settings
  add column if not exists base_url text,
  add column if not exists model text;

update chatbot_settings
set provider = 'openai_compatible',
    base_url = 'https://api.x.ai/v1',
    model = 'grok-4-fast-reasoning'
where provider = 'grok';

alter table chatbot_settings drop constraint if exists chatbot_settings_provider_check;
alter table chatbot_settings add constraint chatbot_settings_provider_check
  check (provider in ('openai_compatible', 'claude'));

notify pgrst, 'reload schema';
