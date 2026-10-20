"use client";

import Link from "next/link";
import { Eye, LockKeyhole, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";
import {
  getSectorKCurrentRevision,
  sectorKContentItems,
  sectorKContentStatusLabels,
  sectorKPublishReadiness,
  sectorKVisibilityLabels,
  type SectorKRevision,
} from "@/lib/sector-k/content-model";

const SCENE_TYPE_LABELS: Record<SectorKRevision["scenes"][number]["type"], string> = {
  principle: "Контекст",
  "live-snapshot": "Рынок",
  calculator: "Калькулятор",
  decision: "Решение",
  checklist: "Фильтр",
};

export function SectorKStudio() {
  const [selectedId, setSelectedId] = useState(sectorKContentItems[0]?.id ?? "");
  const item = sectorKContentItems.find((candidate) => candidate.id === selectedId) ?? sectorKContentItems[0];
  if (!item) return null;
  const revision = getSectorKCurrentRevision(item);
  const readiness = sectorKPublishReadiness(item);

  return (
    <div className="sk-page">
      <header className="sk-page-head sk-page-head--compact">
        <div className="sk-page-head__copy"><p className="sk-kicker">Управление материалами</p><h1>Studio</h1><p>Материалы, версии, статус и видимость.</p></div>
        <div className="sk-page-head__aside"><span className="sk-tag sk-tag--warning"><LockKeyhole size={11} /> Без авторизации</span><span className="sk-source"><span className="sk-source__dot" />Хранение в коде</span></div>
      </header>

      <div className="sk-note">Авторизация: нет · БД: нет · сохранение из интерфейса: нет · публикация: заблокирована.</div>

      <div className="sk-studio-grid">
        <aside className="sk-panel">
          <div className="sk-panel__head"><h2>Контент</h2><span>{sectorKContentItems.length}</span></div>
          <ul className="sk-list">{sectorKContentItems.map((candidate) => (
            <li className={`sk-list__row ${candidate.id === item.id ? "is-selected" : ""}`} key={candidate.id} onClick={() => setSelectedId(candidate.id)}>
              <div className="sk-list__primary"><div className="sk-list__title"><strong>{candidate.title}</strong></div><div className="sk-tags"><span className="sk-tag sk-tag--violet">{sectorKContentStatusLabels[candidate.status]}</span><span className="sk-tag">{sectorKVisibilityLabels[candidate.visibility]}</span></div></div>
            </li>
          ))}</ul>
        </aside>

        <section className="sk-panel">
          <div className="sk-panel__head"><h2>Материал</h2><span className="sk-mono">Версия {revision?.number ?? "—"}</span></div>
          <div className="sk-panel__body sk-grid">
            <div className="sk-studio-title"><div><p className="sk-kicker">Материал · /{item.slug}</p><h2>{item.title}</h2><p>{item.summary}</p></div><div className="sk-tags"><span className="sk-tag sk-tag--violet">{sectorKContentStatusLabels[item.status]}</span><span className="sk-tag">{sectorKVisibilityLabels[item.visibility]}</span></div></div>
            <div className="sk-scene-list">
              {revision?.scenes.map((scene, index) => (
                <div className="sk-scene-row" key={scene.id}><span className="sk-mono">{String(index + 1).padStart(2, "0")}</span><div><strong>{scene.title}</strong><p>{scene.purpose}</p></div><span className="sk-tag">{SCENE_TYPE_LABELS[scene.type]}</span></div>
              ))}
            </div>
          </div>
        </section>

        <aside className="sk-panel">
          <div className="sk-panel__head"><h2>Публикация</h2><ShieldAlert size={15} /></div>
          <div className="sk-panel__body sk-grid">
            <div className="sk-publish-state"><span className={`sk-tag ${readiness.ready ? "sk-tag--positive" : "sk-tag--warning"}`}>{readiness.ready ? "Готово" : "Не готово"}</span><strong>{revision ? `Версия ${revision.number}` : "Нет версии"}</strong><p>{revision?.changelog ?? "Активная версия не найдена."}</p></div>
            {!readiness.ready ? <ul className="sk-checklist sk-checklist--danger">{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}
            <Link className="sk-studio-action" href={`/sector-k/materials/${item.slug}`}><Eye size={15} />Открыть материал</Link>
            <button className="sk-studio-action" type="button" disabled={!readiness.ready}><Send size={15} />Опубликовать версию</button>
            <p className="sk-muted sk-studio-caption">Опубликованная версия: —</p>
          </div>
          <div className="sk-panel__head"><h3>История версий</h3></div>
          <ul className="sk-list">{[...item.revisions].reverse().map((entry) => (
            <li className="sk-list__row" key={entry.id}><div className="sk-list__primary"><div className="sk-list__title"><strong>Версия {entry.number}</strong></div><span className="sk-muted">{entry.changelog}</span></div><span className="sk-tag">{entry.scenes.length} блоков</span></li>
          ))}</ul>
        </aside>
      </div>
    </div>
  );
}
