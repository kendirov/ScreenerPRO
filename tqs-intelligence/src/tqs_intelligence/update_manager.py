from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Any


class UpdateManager:
    def __init__(self, request_path: str = './data/update-request.json') -> None:
        self.request_path=Path(request_path)
        self.request_path.parent.mkdir(parents=True,exist_ok=True)
        self.tqs_root=Path(__file__).resolve().parents[2]
        self.repo_root=Path(__file__).resolve().parents[3]

    def _git(self,*args:str,timeout:int=30) -> str:
        return subprocess.check_output(['git','-C',str(self.repo_root),*args],stderr=subprocess.STDOUT,text=True,timeout=timeout).strip()

    def status(self, fetch: bool=False) -> dict[str,Any]:
        try:
            inside=self._git('rev-parse','--is-inside-work-tree')=='true'
            if not inside: return {'available':False,'reason':'not a git worktree'}
            dirty=bool(self._git('status','--porcelain'))
            branch=self._git('branch','--show-current'); head=self._git('rev-parse','HEAD')
            if fetch:
                try: self._git('fetch','origin',timeout=60)
                except Exception: pass
            try:
                upstream=self._git('rev-parse','--abbrev-ref','@{u}')
                behind=int(self._git('rev-list','--count','HEAD..@{u}') or 0)
                remote_head=self._git('rev-parse','@{u}')
            except Exception:
                upstream=None; behind=0; remote_head=None
            return {'available':True,'branch':branch,'head':head,'dirty':dirty,'upstream':upstream,
                    'behind':behind,'remote_head':remote_head,'update_available':behind>0,'requested':self.request_path.exists()}
        except Exception as exc:
            return {'available':False,'reason':str(exc)}

    def request(self, force: bool=False) -> dict[str,Any]:
        payload={'requested_at_ms':int(time.time()*1000),'force':bool(force)}
        self.request_path.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
        return {'ok':True,**payload}

    def pop_request(self) -> dict[str,Any]|None:
        if not self.request_path.exists(): return None
        try: payload=json.loads(self.request_path.read_text(encoding='utf-8'))
        except Exception: payload={}
        try: self.request_path.unlink()
        except Exception: pass
        return payload
