-- Progresso di Ufficio tecnico: ogni utente vede e modifica solo le proprie righe.
create table public.progress_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('case', 'oral', 'history')),
  item_id text not null check (char_length(item_id) <= 200),
  state jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, kind, item_id)
);

alter table public.progress_items enable row level security;

create policy "select own" on public.progress_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own" on public.progress_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "update own" on public.progress_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own" on public.progress_items for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.progress_items from anon, authenticated;
grant select, insert, update, delete on public.progress_items to authenticated;

-- Salva le modifiche, tiene la più recente per ogni elemento e restituisce tutto il progresso.
create function public.sync_progress(items jsonb)
returns setof public.progress_items
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 5000 then
    raise exception 'invalid items';
  end if;

  insert into public.progress_items (user_id, kind, item_id, state, updated_at)
  select auth.uid(), i.kind, i.item_id, i.state, i.updated_at
  from jsonb_to_recordset(items) as i (kind text, item_id text, state jsonb, updated_at timestamptz)
  on conflict (user_id, kind, item_id) do update
    set state = excluded.state, updated_at = excluded.updated_at
    where excluded.updated_at >= public.progress_items.updated_at;

  return query
    select * from public.progress_items where user_id = auth.uid();
end;
$$;

-- Cancella il progresso dell'utente collegato.
create function public.reset_progress()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.progress_items where user_id = auth.uid();
$$;

revoke all on function public.sync_progress(jsonb) from public, anon;
revoke all on function public.reset_progress() from public, anon;
grant execute on function public.sync_progress(jsonb) to authenticated;
grant execute on function public.reset_progress() to authenticated;
