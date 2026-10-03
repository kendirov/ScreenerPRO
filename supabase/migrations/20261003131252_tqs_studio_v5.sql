-- TQS Studio V5 canonical persistence on existing turbo-family Supabase project.
-- Final schema as deployed 2026-10-03. No new Supabase project/database.

create table if not exists public.studio_owner_access (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_worlds (
  world_key text primary key,
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  title text not null,
  revision bigint not null default 1 check (revision > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_world_objects (
  id text primary key,
  world_key text not null references public.studio_worlds(world_key) on delete cascade,
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  kind text not null,
  semantic_path text not null,
  parent_id text null references public.studio_world_objects(id) on delete set null,
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 320,
  h double precision not null default 120,
  z integer not null default 1,
  title text not null default '',
  body jsonb not null default '{}'::jsonb,
  relations jsonb not null default '[]'::jsonb,
  status text null,
  hidden boolean not null default false,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_world_objects_world_path_idx on public.studio_world_objects(world_key, semantic_path);
create index if not exists studio_world_objects_parent_idx on public.studio_world_objects(parent_id);

create table if not exists public.studio_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  world_key text not null references public.studio_worlds(world_key) on delete cascade,
  entity_id text null,
  semantic_path text not null,
  event_type text not null,
  status text not null default 'NEW' check (status in ('NEW','IN_REVIEW','DONE')),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists studio_activity_query_idx on public.studio_activity(owner_id, semantic_path, status, occurred_at desc);

create table if not exists public.studio_documents (
  id text primary key,
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  world_key text not null references public.studio_worlds(world_key) on delete cascade,
  slug text not null unique,
  kind text not null,
  title text not null,
  semantic_path text not null,
  frame_id text null references public.studio_world_objects(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  status text not null default 'DRAFT',
  share_mode text not null default 'private' check (share_mode in ('private','unlisted','public')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  storage_bucket text not null default 'studio-assets',
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint null,
  sha256 text null,
  drive_ref_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_document_blocks (
  block_id text primary key,
  document_id text not null references public.studio_documents(id) on delete cascade,
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  block_type text not null,
  content jsonb not null default '{}'::jsonb,
  data_spec jsonb null,
  asset_id uuid null references public.studio_assets(id) on delete set null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, ordinal)
);
create index if not exists studio_document_blocks_doc_idx on public.studio_document_blocks(document_id, ordinal);

create table if not exists public.studio_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references public.studio_documents(id) on delete cascade,
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  revision bigint not null,
  snapshot jsonb not null,
  reason text null,
  created_at timestamptz not null default now(),
  unique(document_id, revision)
);

create table if not exists public.studio_drive_connections (
  owner_id uuid primary key references public.studio_owner_access(owner_id) on delete cascade,
  root_id text not null,
  root_name text not null default 'TQS STUDIO — WORLD',
  exports_folder_id text null,
  connected_email text null,
  oauth_secret_name text null,
  scopes text[] not null default '{}'::text[],
  status text not null default 'NOT_CONFIGURED',
  last_sync_at timestamptz null,
  last_error text null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_drive_refs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  drive_file_id text not null,
  root_id text not null,
  drive_revision_id text null,
  drive_version text null,
  drive_modified_time timestamptz null,
  studio_revision bigint not null default 1,
  sync_state text not null default 'SYNCED',
  last_sync_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  unique(owner_id, entity_type, entity_id)
);

create table if not exists public.studio_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  drive_ref_id uuid null references public.studio_drive_refs(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  studio_revision bigint not null,
  drive_revision_id text null,
  drive_modified_time timestamptz null,
  state text not null default 'OPEN' check (state in ('OPEN','RESOLVED_STUDIO','RESOLVED_DRIVE','RESOLVED_MERGED')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create table if not exists public.studio_share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  document_id text not null references public.studio_documents(id) on delete cascade,
  slug text not null,
  token_hash text not null unique,
  mode text not null default 'unlisted' check (mode in ('private','unlisted','public')),
  document_revision bigint not null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);
create index if not exists studio_share_links_slug_idx on public.studio_share_links(slug);

create table if not exists public.studio_oauth_states (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  state_hash text not null unique,
  return_to text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('studio-assets','studio-assets',false,52428800,array['image/png','image/jpeg','image/webp','audio/webm','audio/ogg','audio/mp4','application/pdf','video/mp4','video/webm'])
on conflict (id) do nothing;

create or replace function public.studio_vault_get(p_name text)
returns text language sql security definer set search_path=''
as $$ select decrypted_secret from vault.decrypted_secrets where name=p_name order by created_at desc limit 1 $$;

create or replace function public.studio_vault_put(p_name text,p_value text,p_description text default '')
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name=p_name order by created_at desc limit 1;
  if sid is null then sid := vault.create_secret(p_value,p_name,p_description);
  else perform vault.update_secret(sid,p_value,p_name,p_description); end if;
  return sid;
end $$;

create or replace function public.studio_capture_document_revision(p_document_id text,p_reason text default null)
returns bigint language plpgsql security definer set search_path=''
as $$
declare new_rev bigint; owner uuid; snap jsonb;
begin
  select d.owner_id,d.revision+1 into owner,new_rev from public.studio_documents d where d.id=p_document_id for update;
  if owner is null then raise exception 'document not found'; end if;
  update public.studio_documents set revision=new_rev,updated_at=now() where id=p_document_id;
  select jsonb_build_object(
    'document',(select to_jsonb(d) from public.studio_documents d where d.id=p_document_id),
    'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by b.ordinal),'[]'::jsonb) from public.studio_document_blocks b where b.document_id=p_document_id)
  ) into snap;
  insert into public.studio_document_revisions(document_id,owner_id,revision,snapshot,reason)
  values(p_document_id,owner,new_rev,snap,p_reason)
  on conflict(document_id,revision) do nothing;
  return new_rev;
end $$;

create or replace function public.studio_upsert_document_block(
 p_owner_id uuid,p_document_id text,p_block_id text,p_block_type text,
 p_content jsonb,p_data_spec jsonb default null,p_after_block_id text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare pos int; existing int; new_rev bigint;
begin
  if not exists(select 1 from public.studio_documents d where d.id=p_document_id and d.owner_id=p_owner_id) then raise exception 'document not found'; end if;
  select ordinal into existing from public.studio_document_blocks where block_id=p_block_id and document_id=p_document_id;
  if existing is not null then
    update public.studio_document_blocks set block_type=p_block_type,content=coalesce(p_content,'{}'::jsonb),data_spec=p_data_spec,revision=revision+1,updated_at=now()
    where block_id=p_block_id and owner_id=p_owner_id;
  else
    if p_after_block_id='__FIRST__' then
      pos:=1;
      update public.studio_document_blocks set ordinal=ordinal+100000 where document_id=p_document_id and ordinal>=pos;
      update public.studio_document_blocks set ordinal=ordinal-99999 where document_id=p_document_id and ordinal>=pos+100000;
    elsif p_after_block_id is null then
      select coalesce(max(ordinal),0)+1 into pos from public.studio_document_blocks where document_id=p_document_id;
    else
      select ordinal+1 into pos from public.studio_document_blocks where document_id=p_document_id and block_id=p_after_block_id;
      if pos is null then raise exception 'after block not found'; end if;
      update public.studio_document_blocks set ordinal=ordinal+100000 where document_id=p_document_id and ordinal>=pos;
      update public.studio_document_blocks set ordinal=ordinal-99999 where document_id=p_document_id and ordinal>=pos+100000;
    end if;
    insert into public.studio_document_blocks(block_id,document_id,owner_id,ordinal,block_type,content,data_spec)
    values(p_block_id,p_document_id,p_owner_id,pos,p_block_type,coalesce(p_content,'{}'::jsonb),p_data_spec);
  end if;
  new_rev:=public.studio_capture_document_revision(p_document_id,'upsert block '||p_block_id);
  return jsonb_build_object('block',(select to_jsonb(b) from public.studio_document_blocks b where b.block_id=p_block_id),'documentRevision',new_rev);
end $$;

create or replace function public.studio_reorder_document_block(
 p_owner_id uuid,p_document_id text,p_block_id text,p_target_ordinal int
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare cnt int; new_rev bigint;
begin
  if not exists(select 1 from public.studio_documents d where d.id=p_document_id and d.owner_id=p_owner_id) then raise exception 'document not found'; end if;
  if not exists(select 1 from public.studio_document_blocks b where b.document_id=p_document_id and b.block_id=p_block_id) then raise exception 'block not found'; end if;
  select count(*) into cnt from public.studio_document_blocks where document_id=p_document_id;
  p_target_ordinal:=greatest(1,least(p_target_ordinal,cnt));
  create temporary table if not exists pg_temp.studio_order(block_id text primary key, rn int) on commit drop;
  truncate pg_temp.studio_order;
  insert into pg_temp.studio_order(block_id,rn)
  select x.block_id,row_number() over(order by x.sort_key,x.ordinal,x.block_id)::int
  from (
    select b.block_id,b.ordinal,
      case when b.block_id=p_block_id then p_target_ordinal::numeric
           when b.ordinal>=p_target_ordinal then b.ordinal+0.5
           else b.ordinal::numeric end sort_key
    from public.studio_document_blocks b where b.document_id=p_document_id
  ) x;
  update public.studio_document_blocks b set ordinal=100000+o.rn from pg_temp.studio_order o where b.block_id=o.block_id;
  update public.studio_document_blocks set ordinal=ordinal-100000 where document_id=p_document_id and ordinal>=100000;
  new_rev:=public.studio_capture_document_revision(p_document_id,'reorder block '||p_block_id);
  return jsonb_build_object('blocks',(select jsonb_agg(to_jsonb(b) order by b.ordinal) from public.studio_document_blocks b where b.document_id=p_document_id),'documentRevision',new_rev);
end $$;

revoke all on function public.studio_vault_get(text) from public,anon,authenticated;
revoke all on function public.studio_vault_put(text,text,text) from public,anon,authenticated;
revoke all on function public.studio_capture_document_revision(text,text) from public,anon,authenticated;
revoke all on function public.studio_upsert_document_block(uuid,text,text,text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.studio_reorder_document_block(uuid,text,text,int) from public,anon,authenticated;
grant execute on function public.studio_vault_get(text) to service_role;
grant execute on function public.studio_vault_put(text,text,text) to service_role;
grant execute on function public.studio_capture_document_revision(text,text) to service_role;
grant execute on function public.studio_upsert_document_block(uuid,text,text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.studio_reorder_document_block(uuid,text,text,int) to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'studio_owner_access','studio_worlds','studio_world_objects','studio_activity','studio_documents',
    'studio_assets','studio_document_blocks','studio_document_revisions','studio_drive_connections',
    'studio_drive_refs','studio_sync_conflicts','studio_share_links','studio_oauth_states'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
    execute format('grant select,insert,update,delete on table public.%I to service_role',t);
  end loop;
end $$;


-- Owner bootstrap fallback: server-generated one-time sign-in without email delivery.
create table if not exists public.studio_owner_bootstrap_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.studio_owner_access(owner_id) on delete cascade,
  token_hash text not null unique,
  return_to text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);
alter table public.studio_owner_bootstrap_tokens enable row level security;
revoke all on table public.studio_owner_bootstrap_tokens from anon, authenticated;
grant select,insert,update,delete on table public.studio_owner_bootstrap_tokens to service_role;
