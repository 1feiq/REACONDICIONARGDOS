begin;
create function public.confirm_and_publish(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'forbidden'; end if;
 update public.device_contacts set permission_confirmed_at=now(),last_verified_at=now(),updated_at=now() where device_id=p_id;
 if not found then raise exception 'contact_missing'; end if;
 perform public.set_device_status(p_id,'publicado');
end;$$;
revoke all on function public.confirm_and_publish(uuid) from public,anon,authenticated;
grant execute on function public.confirm_and_publish(uuid) to authenticated;
create function private.validate_publication() returns trigger language plpgsql set search_path='' as $$
begin
 if new.source='usuario' and new.owner_id is null and new.status='publicado' then new.status:='archivado'; end if;
 if concat_ws(' ',new.brand,new.model,new.description,new.neighborhood) ~* '(https?://|www\.|wa\.me|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(\+?[0-9][ ()-]*){8,})' then raise exception 'contact_in_public_fields'; end if;
 if TG_OP='INSERT' and not private.is_admin() and (select count(*) from public.devices where created_by=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'daily_publication_limit'; end if;
 return new;
end;$$;
create trigger validate_publication before insert or update on public.devices for each row execute function private.validate_publication();
revoke all on function private.validate_publication() from public;
commit;
