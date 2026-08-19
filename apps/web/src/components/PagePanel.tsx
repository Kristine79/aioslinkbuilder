/**
 * Page-level analysis + link insert assistant + anchor strategy graphics.
 */

import type { AnchorStrategyDto, LinkInsertDto, PageAnalysisDto } from '../api/types';
import { ANCHOR_TYPE_LABELS, PAGE_TYPE_LABELS } from '../ru';
import { MetricStatusTag } from './Metric';

function BarRow({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${value}%` }} />
      </span>
      <span className="bar-value">{value}</span>
    </div>
  );
}

export function PageAnalysisPanel({ page }: { page: PageAnalysisDto }) {
  return (
    <div>
      <div className="kv-grid">
        <div className="kv">
          <span className="kv-key">Целевая страница</span>
          <span className="kv-value" style={{ wordBreak: 'break-all' }}>
            {page.targetPage ?? page.targetDomain}
          </span>
        </div>
        <div className="kv">
          <span className="kv-key">Заголовок</span>
          <span className="kv-value">{page.pageTitle ?? '—'}</span>
        </div>
        <div className="kv">
          <span className="kv-key">Тип страницы</span>
          <span className="kv-value">{PAGE_TYPE_LABELS[page.pageType] ?? page.pageType}</span>
        </div>
        <div className="kv">
          <span className="kv-key">Индексация</span>
          <span className="kv-value">
            {page.indexation.value === 'INDEXED'
              ? 'проиндексирована'
              : page.indexation.value === 'PARTIAL'
                ? 'частично'
                : page.indexation.value === 'NOT_INDEXED'
                  ? 'не проиндексирована'
                  : '—'}
            {page.indexation.status !== 'UNKNOWN' && (
              <span style={{ marginLeft: 6 }}>
                <MetricStatusTag status={page.indexation.status} />
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-8" style={{ maxWidth: 420 }}>
        <BarRow label="Релевантность страницы" value={page.topicalRelevance.value} />
        <BarRow label="Пригодность для вставки" value={page.linkInsertSuitability.value} />
      </div>

      {page.suggestedPlacementLocation !== null && (
        <div className="mt-8 text-secondary" style={{ fontSize: 13 }}>
          Предлагаемое место: {page.suggestedPlacementLocation}
        </div>
      )}
      {page.summary !== null && (
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 8 }}>
          {page.summary}
        </p>
      )}
    </div>
  );
}

export function LinkInsertPanel({
  linkInsert,
  anchor,
}: {
  linkInsert: LinkInsertDto;
  anchor: AnchorStrategyDto | null;
}) {
  return (
    <div className="linkinsert">
      {anchor !== null && (
        <div className="linkinsert-block">
          <div className="linkinsert-caption">Анкор-стратегия</div>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="anchor-badge">{anchor.anchor}</span>
            <span className="chip">{ANCHOR_TYPE_LABELS[anchor.anchorType] ?? anchor.anchorType}</span>
            {anchor.profileAvailable && (
              <span className="chip">учтён анкор-профиль компании</span>
            )}
          </div>
          <div className="mt-8 text-secondary" style={{ fontSize: 13 }}>
            {anchor.explanation}
          </div>
          {anchor.alternatives.length > 0 && (
            <div className="mt-8">
              Альтернативы:{' '}
              {anchor.alternatives.map((a) => (
                <span className="chip" key={a}>
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="linkinsert-block" style={{ marginTop: linkInsert === null ? 0 : 14 }}>
        <div className="linkinsert-caption">Предлагаемая вставка</div>
        <div className="linkinsert-text">
          «{linkInsert.text}» <span className="chip">анкор: {linkInsert.anchor}</span>
        </div>
        {linkInsert.suggestedInsertionPoint && (
          <div className="text-secondary" style={{ fontSize: 13, marginTop: 6 }}>
            Место: {linkInsert.suggestedInsertionPoint}
          </div>
        )}
        <div className="text-secondary" style={{ fontSize: 13, marginTop: 6 }}>
          {linkInsert.explanation}
        </div>
        {linkInsert.confidence !== null && (
          <div className="text-tertiary" style={{ fontSize: 12, marginTop: 6 }}>
            Уверенность AI: {linkInsert.confidence}/100
          </div>
        )}
      </div>
    </div>
  );
}
