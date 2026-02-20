create or replace function public.guard_profile_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role/admin scripts may run without a JWT subject.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change role';
    end if;

    if new.is_disabled is distinct from old.is_disabled then
      raise exception 'Only admins can change is_disabled';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_sensitive_updates on public.profiles;

create trigger profiles_guard_sensitive_updates
before update on public.profiles
for each row
execute function public.guard_profile_sensitive_updates();
