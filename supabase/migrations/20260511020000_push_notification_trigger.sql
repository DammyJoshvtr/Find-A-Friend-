-- Migration: fire push notification edge function on every new notification row
-- Timestamp: 20260511020000
--
-- This trigger calls the `send-push-notification` Supabase Edge Function
-- via pg_net whenever a row is inserted into the notifications table.
-- The edge function fetches the recipient's push_token and sends via Expo.

-- pg_net is pre-installed on hosted Supabase in the `net` schema.
-- This is a no-op if already present.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- Trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_push_notification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://vcbtvhociaioeyhhsczh.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer sb_publishable_oN3ImQ-mtGa2QgnBXQ-xqA_gP3GfVwe'
    ),
    body    := to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Attach trigger to notifications table
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_push_notification ON public.notifications;
CREATE TRIGGER trg_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_push_notification();
