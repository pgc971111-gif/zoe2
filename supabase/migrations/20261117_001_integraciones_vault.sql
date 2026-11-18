-- ZOE: store provider credentials in Supabase Vault, never as plaintext rows.
-- Apply once in the Supabase SQL Editor. Existing opportunities, processes,
-- and tasks are not modified by this migration.

begin;

create extension if not exists supabase_vault with schema vault;

create table public.integraciones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  proveedor text not null check (
    proveedor in (
      'tavily', 'firecrawl', 'gemini', 'groq',
      'facebook', 'tiktok', 'instagram', 'youtube'
    )
  ),
  credencial text not null check (
    credencial in (
      'api_key', 'app_id', 'app_secret', 'access_token',
      'refresh_token', 'client_id', 'client_key', 'client_secret',
      'page_id', 'channel_id', 'ig_user_id'
    )
  ),
  vault_secret_id uuid not null unique,
  estado text not null default 'activa'
    check (estado in ('activa', 'inactiva')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, proveedor, credencial)
);

alter table public.integraciones enable row level security;

create policy integraciones_select_propias
  on public.integraciones
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.integraciones from anon, authenticated;

create or replace function public.list_integraciones()
returns table (
  id uuid,
  proveedor text,
  credencial text,
  estado text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null then
    raise exception 'Se requiere una sesión iniciada';
  end if;

  return query
    select i.id, i.proveedor, i.credencial, i.estado, i.created_at, i.updated_at
    from public.integraciones as i
    where i.owner_id = v_owner_id
    order by i.proveedor, i.credencial;
end;
$$;

create or replace function public.upsert_integracion_secret(
  p_proveedor text,
  p_credencial text,
  p_valor text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_id uuid;
  v_secret_id uuid;
  v_secret_name text;
begin
  if v_owner_id is null then
    raise exception 'Se requiere una sesión iniciada';
  end if;
  if p_proveedor not in (
    'tavily', 'firecrawl', 'gemini', 'groq',
    'facebook', 'tiktok', 'instagram', 'youtube'
  ) then
    raise exception 'Proveedor no permitido';
  end if;
  if p_credencial not in (
    'api_key', 'app_id', 'app_secret', 'access_token',
    'refresh_token', 'client_id', 'client_key', 'client_secret',
    'page_id', 'channel_id', 'ig_user_id'
  ) then
    raise exception 'Tipo de credencial no permitido';
  end if;
  if p_valor is null or btrim(p_valor) = '' then
    raise exception 'La credencial no puede estar vacía';
  end if;

  v_secret_name := format(
    'zoe:%s:%s:%s', v_owner_id, p_proveedor, p_credencial
  );

  select i.id, i.vault_secret_id
    into v_id, v_secret_id
    from public.integraciones as i
    where i.owner_id = v_owner_id
      and i.proveedor = p_proveedor
      and i.credencial = p_credencial
    for update;

  if v_id is null then
    v_secret_id := vault.create_secret(
      p_valor, v_secret_name, 'Credencial de una integración ZOE'
    );
    insert into public.integraciones (
      owner_id, proveedor, credencial, vault_secret_id
    ) values (
      v_owner_id, p_proveedor, p_credencial, v_secret_id
    ) returning id into v_id;
  else
    perform vault.update_secret(
      v_secret_id, p_valor, v_secret_name, 'Credencial de una integración ZOE'
    );
    update public.integraciones as i
      set estado = 'activa', updated_at = now()
      where i.id = v_id and i.owner_id = v_owner_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.get_integracion_secret(
  p_proveedor text,
  p_credencial text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_valor text;
begin
  if v_owner_id is null then
    raise exception 'Se requiere una sesión iniciada';
  end if;

  select s.decrypted_secret into v_valor
    from public.integraciones as i
    join vault.decrypted_secrets as s on s.id = i.vault_secret_id
    where i.owner_id = v_owner_id
      and i.proveedor = p_proveedor
      and i.credencial = p_credencial
      and i.estado = 'activa';

  return v_valor;
end;
$$;

revoke all on function public.list_integraciones() from public, anon;
revoke all on function public.upsert_integracion_secret(text, text, text)
  from public, anon;
revoke all on function public.get_integracion_secret(text, text)
  from public, anon;

grant execute on function public.list_integraciones() to authenticated;
grant execute on function public.upsert_integracion_secret(text, text, text)
  to authenticated;
grant execute on function public.get_integracion_secret(text, text)
  to authenticated;

commit;
