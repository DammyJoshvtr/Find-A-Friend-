-- Migration: Notification triggers for clubs, events, vendors, and club chat
-- These run with SECURITY DEFINER so they can INSERT into notifications
-- bypassing RLS (which only allows service_role to INSERT).

-- ─── Add new notification types (if column is typed enum, add values) ─────────
-- The notifications.type column is assumed to be TEXT/VARCHAR.
-- If you used a Postgres ENUM, run ALTER TYPE notification_type ADD VALUE '...' for each below.

-- ─── 1. Trigger: Notify all users when a new CLUB is created ─────────────────

CREATE OR REPLACE FUNCTION public.notify_new_club()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a notification for every user except the club creator
  INSERT INTO notifications (user_id, type, actor_id, entity_type, entity_id, body)
  SELECT
    p.id,
    'club_announcement',
    NEW.created_by,
    'club',
    NEW.id,
    '🎉 New club: ' || NEW.name || ' — ' || COALESCE(NEW.description, 'Check it out!')
  FROM profiles p
  WHERE p.id != NEW.created_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_club ON public.clubs;
CREATE TRIGGER trg_notify_new_club
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_club();

-- ─── 2. Trigger: Notify all users when a new EVENT is created ────────────────

CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify for public events
  IF NEW.is_public = true THEN
    INSERT INTO notifications (user_id, type, actor_id, entity_type, entity_id, body)
    SELECT
      p.id,
      'event_rsvp',
      NEW.organizer_id,
      'event',
      NEW.id,
      '📅 New event: ' || NEW.title || COALESCE(' at ' || NEW.venue, '')
    FROM profiles p
    WHERE p.id != NEW.organizer_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_event ON public.events;
CREATE TRIGGER trg_notify_new_event
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_event();

-- ─── 3. Trigger: Notify all users when a VENDOR is approved ──────────────────

CREATE OR REPLACE FUNCTION public.notify_vendor_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when is_approved flips from false→true
  IF OLD.is_approved = false AND NEW.is_approved = true THEN
    INSERT INTO notifications (user_id, type, actor_id, entity_type, entity_id, body)
    SELECT
      p.id,
      'club_announcement',
      NEW.owner_id,
      'club',   -- reuse 'club' entity type, navigates to /vendor/:id handled in notifications.tsx
      NEW.id,
      '🛍️ New vendor on campus: ' || NEW.name || ' — ' || COALESCE(NEW.description, 'Explore deals!')
    FROM profiles p
    WHERE p.id != NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_vendor_approved ON public.vendors;
CREATE TRIGGER trg_notify_vendor_approved
  AFTER UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vendor_approved();

-- ─── 4. Trigger: Notify club MEMBERS when a message is sent in club chat ─────

CREATE OR REPLACE FUNCTION public.notify_club_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
BEGIN
  -- Get sender's name
  SELECT full_name INTO v_sender_name
  FROM profiles WHERE id = NEW.sender_id;

  -- Notify all club members except the sender
  INSERT INTO notifications (user_id, type, actor_id, entity_type, entity_id, body)
  SELECT
    cm.user_id,
    'club_announcement',
    NEW.sender_id,
    'club',
    NEW.club_id,
    COALESCE(v_sender_name, 'Someone') || ' sent a message in your club'
  FROM club_members cm
  WHERE cm.club_id = NEW.club_id
    AND cm.user_id != NEW.sender_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_club_message ON public.club_messages;
CREATE TRIGGER trg_notify_club_message
  AFTER INSERT ON public.club_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_club_message();
