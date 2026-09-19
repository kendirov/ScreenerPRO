from pathlib import Path

from tqs_intelligence.lab_store import LabStore
from tqs_intelligence.strategy_machine import default_round_buffer_spec


def test_lab_store_idea_job_strategy_roundtrip(tmp_path: Path):
    lab=LabStore(str(tmp_path/'lab.sqlite3'))
    idea=lab.add_idea('Буферные зоны','Проверить отскок от круглого','artem','strategy',80,['round'])
    assert idea['id'].startswith('I-')
    assert lab.list_ideas()[0]['text'].startswith('Проверить')
    job=lab.enqueue_job('verify_lake','Проверить lake',{})
    claimed=lab.claim_next_job()
    assert claimed and claimed.id == job.id and claimed.status == 'running'
    lab.update_job(job.id,status='done',progress=1,result={'ok':True})
    assert lab.list_jobs()[0].status == 'done'
    spec=default_round_buffer_spec(); lab.save_strategy(spec)
    assert lab.get_strategy(spec.id).name_ru == spec.name_ru
    assert lab.stats()['strategies'] == 1
