-- Open-review share RPCs for TQS Studio V5.
-- Uses the existing Studio owner and stores only hashed unlisted tokens.

create or replace function public.studio_public_share_create(p_document_id text,p_app_origin text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_owner uuid;
  v_doc public.studio_documents%rowtype;
  v_token text;
  v_hash text;
begin
  if p_app_origin is null or (
    p_app_origin !~ '^https://[A-Za-z0-9.-]+\.vercel\.app$'
    and p_app_origin !~ '^http://(localhost|127\.0\.0\.1):[0-9]+$'
  ) then
    raise exception 'INVALID_APP_ORIGIN';
  end if;

  select owner_id into v_owner
  from public.studio_owner_access
  where lower(email)=lower('kendirov@gmail.com')
  limit 1;
  if v_owner is null then raise exception 'PUBLIC_OWNER_NOT_FOUND'; end if;

  select * into v_doc
  from public.studio_documents
  where owner_id=v_owner and id=p_document_id;
  if not found then raise exception 'DOCUMENT_NOT_FOUND'; end if;

  update public.studio_share_links
  set revoked_at=now()
  where owner_id=v_owner and document_id=p_document_id and revoked_at is null;

  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');

  insert into public.studio_share_links(owner_id,document_id,slug,token_hash,mode,document_revision)
  values(v_owner,p_document_id,v_doc.slug,v_hash,'unlisted',v_doc.revision);

  update public.studio_documents
  set share_mode='unlisted',updated_at=now()
  where owner_id=v_owner and id=p_document_id;

  return jsonb_build_object(
    'token',v_token,
    'url',rtrim(p_app_origin,'/')||'/d/'||v_doc.slug||'?t='||v_token,
    'slug',v_doc.slug,
    'documentRevision',v_doc.revision
  );
end $$;

create or replace function public.studio_public_share_load(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_hash text;
  v_link public.studio_share_links%rowtype;
begin
  if coalesce(p_token,'')='' then return null; end if;
  v_hash:=encode(extensions.digest(p_token,'sha256'),'hex');

  select * into v_link
  from public.studio_share_links
  where token_hash=v_hash
    and revoked_at is null
    and (expires_at is null or expires_at>now())
  limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'document',(select to_jsonb(d) from public.studio_documents d where d.owner_id=v_link.owner_id and d.id=v_link.document_id),
    'blocks',coalesce((select jsonb_agg(to_jsonb(b) order by b.ordinal) from public.studio_document_blocks b where b.owner_id=v_link.owner_id and b.document_id=v_link.document_id),'[]'::jsonb),
    'share',jsonb_build_object('mode',v_link.mode,'documentRevision',v_link.document_revision,'slug',v_link.slug)
  );
end $$;

revoke all on function public.studio_public_share_create(text,text) from public;
revoke all on function public.studio_public_share_load(text) from public;
grant execute on function public.studio_public_share_create(text,text) to anon,authenticated;
grant execute on function public.studio_public_share_load(text) to anon,authenticated;
