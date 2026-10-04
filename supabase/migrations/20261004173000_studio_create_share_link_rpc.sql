create or replace function public.studio_create_share_link(
  p_owner_id uuid,
  p_document_id text,
  p_token_hash text
)
returns table(slug text, document_revision bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_revision bigint;
begin
  select d.slug,d.revision into v_slug,v_revision
  from public.studio_documents d
  where d.id=p_document_id and d.owner_id=p_owner_id
  for update;
  if not found then raise exception 'document not found'; end if;

  update public.studio_share_links
  set revoked_at=now()
  where owner_id=p_owner_id and document_id=p_document_id and revoked_at is null;

  insert into public.studio_share_links(owner_id,document_id,slug,token_hash,mode,document_revision)
  values(p_owner_id,p_document_id,v_slug,p_token_hash,'unlisted',v_revision);

  update public.studio_documents
  set share_mode='unlisted',updated_at=now()
  where id=p_document_id and owner_id=p_owner_id;

  return query select v_slug,v_revision;
end;
$$;

revoke all on function public.studio_create_share_link(uuid,text,text) from public,anon,authenticated;
grant execute on function public.studio_create_share_link(uuid,text,text) to service_role;
