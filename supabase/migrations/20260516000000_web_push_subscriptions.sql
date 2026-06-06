-- Web Push (VAPID) subscriptions for iOS PWA and Android PWA background push.
-- Each user has at most one active subscription (upsert on user_id).

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own subscription only
CREATE POLICY "Users can upsert own web push subscription"
  ON public.web_push_subscriptions
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
