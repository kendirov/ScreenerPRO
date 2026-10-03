-- Complete the canonical V5 test lesson used by World, clean share and PDF QA.

do $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.studio_documents where id='doc-lesson-workspace';
  if v_owner is null then raise exception 'doc-lesson-workspace missing'; end if;

  update public.studio_document_blocks
  set content='{"columns":["Элемент","Зачем"],"rows":[["График","Контекст цены"],["Стакан","Текущая ликвидность"],["Лента","Агрессор и темп"]]}'::jsonb,
      revision=revision+1,updated_at=now()
  where block_id='lesson-table' and document_id='doc-lesson-workspace';

  update public.studio_document_blocks
  set content='{"items":[{"label":"Связанный World Frame","entityId":"lesson-free-1"},{"label":"MOEX ISS","type":"market_data"}]}'::jsonb,
      revision=revision+1,updated_at=now()
  where block_id='lesson-sources' and document_id='doc-lesson-workspace';

  insert into public.studio_document_blocks(block_id,document_id,owner_id,ordinal,block_type,content,data_spec,revision)
  values
  ('lesson-chart','doc-lesson-workspace',v_owner,6,'interactive_chart',
   '{"title":"Si — интерактивный график"}'::jsonb,
   '{"provider":"MOEX_ISS","instrument":{"family":"SI","resolver":"front_active_contract"},"metric":"ohlcv_session","relativeRange":{"tradingSessions":2},"fixedRange":null,"transforms":["group_by_session","cumulative_volume"],"display":{"renderer":"studio_market_chart","crosshair":true,"periodControl":true},"updatePolicy":"LIVE","asOf":null}'::jsonb,1),
  ('lesson-live','doc-lesson-workspace',v_owner,7,'live_data',
   '{"title":"Si — реальный объём текущей и прошлой сессии"}'::jsonb,
   '{"provider":"MOEX_ISS","instrument":{"family":"SI","resolver":"front_active_contract"},"metric":"ohlcv_session","relativeRange":{"tradingSessions":2},"fixedRange":null,"transforms":["group_by_session","cumulative_volume"],"display":{"renderer":"studio_market_chart","crosshair":true,"periodControl":true},"updatePolicy":"LIVE","asOf":null}'::jsonb,1),
  ('lesson-replay','doc-lesson-workspace',v_owner,8,'market_replay',
   '{"title":"Market Replay — Si, день за 30 секунд"}'::jsonb,
   '{"provider":"MOEX_ISS","instrument":{"family":"SI","resolver":"front_active_contract"},"metric":"ohlcv","relativeRange":{"tradingSessions":1},"fixedRange":null,"transforms":["chronological"],"display":{"renderer":"studio_market_replay","targetDurationSeconds":30},"updatePolicy":"LIVE","asOf":null}'::jsonb,1),
  ('lesson-image','doc-lesson-workspace',v_owner,9,'image',
   '{"caption":"Сюда можно вставить скрин рабочего пространства и рисовать поверх него."}'::jsonb,null,1),
  ('lesson-video','doc-lesson-workspace',v_owner,10,'video',
   '{"title":"Видео / запись экрана — тестовый reference"}'::jsonb,null,1),
  ('lesson-pdf','doc-lesson-workspace',v_owner,11,'pdf_excerpt',
   '{"title":"PDF / конспект","text":"Тестовый excerpt: блок можно адресовать по номеру и stable block_id.","page":1}'::jsonb,null,1),
  ('lesson-div','doc-lesson-workspace',v_owner,12,'divider','{}'::jsonb,null,1),
  ('lesson-end','doc-lesson-workspace',v_owner,13,'rich_text',
   '{"html":"<p>Проверь: вставку между блоками, drag reorder, переход «На доске», share и PDF.</p>"}'::jsonb,null,1)
  on conflict (block_id) do update set
    ordinal=excluded.ordinal,block_type=excluded.block_type,content=excluded.content,
    data_spec=excluded.data_spec,revision=public.studio_document_blocks.revision+1,updated_at=now();

  perform public.studio_capture_document_revision('doc-lesson-workspace','complete canonical V5 lesson demo');
end $$;
