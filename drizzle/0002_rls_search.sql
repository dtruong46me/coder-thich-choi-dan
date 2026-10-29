-- Row-Level Security: the second layer behind canRead() in lib/access-rules.ts.
-- The app connects as a role that does NOT own the tables, so these policies apply to it.
-- Each request sets app.role / app.user_id / app.email / app.member / app.unlisted_token
-- inside its transaction (lib/db/client.ts withScope). The schema owner (migrations) bypasses RLS.

CREATE OR REPLACE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(nullif(current_setting('app.role', true), ''), 'anon') $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_can_read_post(
  p_id uuid, p_kind post_kind, p_status post_status, p_visibility visibility, p_deleted timestamptz, p_token text
) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
  SELECT CASE
    WHEN app_role() IN ('owner', 'system') THEN true
    WHEN p_deleted IS NOT NULL OR p_status <> 'published' THEN false
    WHEN p_visibility = 'public' THEN true
    WHEN p_visibility = 'unlisted' THEN
      p_token IS NOT NULL AND p_token = nullif(current_setting('app.unlisted_token', true), '')
    WHEN p_visibility = 'members' THEN
      app_role() = 'reader' AND (
        current_setting('app.member', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM access_grants g
          WHERE g.email = nullif(current_setting('app.email', true), '')::citext
            AND g.scope = 'members' AND g.revoked_at IS NULL
            AND (g.expires_at IS NULL OR g.expires_at > now())
        )
      )
    WHEN p_visibility = 'shared' THEN
      app_role() = 'reader' AND EXISTS (
        SELECT 1 FROM access_grants g
        WHERE g.email = nullif(current_setting('app.email', true), '')::citext
          AND g.revoked_at IS NULL
          AND (g.expires_at IS NULL OR g.expires_at > now())
          AND ((g.scope = 'post' AND g.post_id = p_id) OR (g.scope = 'all_shared_diary' AND p_kind = 'diary'))
      )
    ELSE false
  END
  $$;
--> statement-breakpoint

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY posts_read ON posts FOR SELECT
  USING (app_can_read_post(id, kind, status, visibility, deleted_at, unlisted_token));
--> statement-breakpoint
CREATE POLICY posts_write ON posts FOR ALL
  USING (app_role() IN ('owner', 'system'))
  WITH CHECK (app_role() IN ('owner', 'system'));
--> statement-breakpoint

ALTER TABLE post_revisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY post_revisions_owner ON post_revisions FOR ALL
  USING (app_role() IN ('owner', 'system'))
  WITH CHECK (app_role() IN ('owner', 'system'));
--> statement-breakpoint

-- Locked cards: strangers may learn that a post exists, its date, collection and mode. Nothing else.
CREATE OR REPLACE FUNCTION locked_post_stubs()
  RETURNS TABLE (id uuid, kind post_kind, visibility visibility, published_at timestamptz, collection_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
  SELECT p.id, p.kind, p.visibility, p.published_at, p.collection_id
  FROM posts p
  WHERE p.status = 'published' AND p.deleted_at IS NULL AND p.visibility IN ('members', 'shared', 'private')
  $$;
--> statement-breakpoint

-- Search: title (A), excerpt (B), body text (C). `simple` config plus unaccent, so "dan" finds "đàn".
CREATE OR REPLACE FUNCTION post_search_vector(p_title text, p_excerpt text, p_body text) RETURNS tsvector
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$
  SELECT setweight(to_tsvector('simple', f_unaccent(coalesce(p_title, ''))), 'A')
      || setweight(to_tsvector('simple', f_unaccent(coalesce(p_excerpt, ''))), 'B')
      || setweight(to_tsvector('simple', f_unaccent(coalesce(p_body, ''))), 'C')
  $$;
--> statement-breakpoint

-- Typo-tolerant title search ("hiragna" -> "Hiragana") on the unaccented title.
CREATE INDEX IF NOT EXISTS posts_title_unaccent_trgm_idx ON posts USING gin (f_unaccent(lower(title)) gin_trgm_ops);
