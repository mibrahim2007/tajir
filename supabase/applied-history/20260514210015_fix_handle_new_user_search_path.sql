
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id   uuid;
  v_org_name text;
BEGIN
  v_org_name := coalesce(new.raw_user_meta_data->>'org_name', 'My Organization');

  INSERT INTO public.organizations (name, owner_id, plan)
  VALUES (v_org_name, new.id, 'FREE')
  RETURNING id INTO v_org_id;

  INSERT INTO public.org_members (org_id, user_id, role, accepted_at)
  VALUES (v_org_id, new.id, 'OWNER', now());

  INSERT INTO public.subscriptions (org_id, plan, status)
  VALUES (v_org_id, 'STARTER', 'TRIAL');

  RETURN new;
END;
$$;
