/**
 * Outreach + negotiation copilot panel. Human-in-the-loop: AI prepares, the
 * human reviews and approves, and only an explicit human action sends the
 * message.
 */

import { useState } from 'react';

import type { NegotiationDto, OutreachDto } from '../api/types';
import { NEGOTIATION_INTENT_LABELS, OUTREACH_STATUS_LABELS } from '../ru';
import { DEMO_DONOR_REPLY_PLACEHOLDER } from '../constants';

function PriceRange({ range }: { range: { min: number; max: number; currency: string } | null }) {
  if (range === null) return null;
  return (
    <span className="chip">
      рекомендация: {range.min}–{range.max} {range.currency}
    </span>
  );
}

export function OutreachPanel({
  outreach,
  negotiation,
  busy,
  onStatus,
  onAnalyzeReply,
  onRespond,
}: {
  outreach: OutreachDto;
  negotiation: NegotiationDto | null;
  busy: boolean;
  onStatus: (status: string) => void;
  onAnalyzeReply: (reply: string) => void;
  onRespond: (payload: { agree: boolean; customResponse?: string }) => void;
}) {
  const [reply, setReply] = useState('');
  const [custom, setCustom] = useState('');

  const message = outreach.message;
  const status = outreach.status;
  const analysis = negotiation?.analysis ?? null;

  const showControls = status === 'DRAFT' || status === 'READY_FOR_REVIEW' || status === 'APPROVED';

  return (
    <div>
      <div className="flex-between mb-8">
        <span className="chip">
          Статус: <strong>{OUTREACH_STATUS_LABELS[status] ?? status}</strong>
        </span>
        {outreach.provider !== null && (
          <span className="text-tertiary" style={{ fontSize: 12 }}>
            через {outreach.provider}
            {outreach.externalId !== null ? ` · ${outreach.externalId}` : ''}
          </span>
        )}
      </div>

      {message === null ? (
        <div className="empty-note">Outreach ещё не сформирован.</div>
      ) : (
        <div className="outreach-message">
          <div className="outreach-field">
            <span className="outreach-hint">Тема</span>
            <div className="outreach-text">{message.subject}</div>
          </div>
          <div className="outreach-field">
            <span className="outreach-hint">Сообщение</span>
            <div className="outreach-text">{message.message}</div>
          </div>
          <div className="flex" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="outreach-mini">
              <div className="outreach-hint">Приветствие</div>
              <div>{message.opening}</div>
            </div>
            <div className="outreach-mini">
              <div className="outreach-hint">Ценность</div>
              <div>{message.valueProposition}</div>
            </div>
            <div className="outreach-mini">
              <div className="outreach-hint">Запрос</div>
              <div>{message.placementRequest}</div>
            </div>
          </div>
        </div>
      )}

      {showControls && (
        <div className="row-actions mt-8">
          {status === 'DRAFT' && (
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              disabled={busy}
              onClick={() => onStatus('READY_FOR_REVIEW')}
            >
              Готово к проверке
            </button>
          )}
          {status === 'READY_FOR_REVIEW' && (
            <>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={busy}
                onClick={() => onStatus('APPROVED')}
              >
                Одобрить
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={busy}
                onClick={() => onStatus('DRAFT')}
              >
                Вернуть в черновик
              </button>
            </>
          )}
          {status === 'APPROVED' && (
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={busy}
              onClick={() => onStatus('SENT')}
            >
              Отправить
            </button>
          )}
        </div>
      )}

      {status === 'SENT' && (
        <div className="mt-16">
          <div className="outreach-hint" style={{ marginBottom: 6 }}>
            Получен ответ площадки? Вставьте его — AI проанализирует и подготовит ответ.
          </div>
          <textarea
            className="input"
            rows={3}
            value={reply}
            placeholder={DEMO_DONOR_REPLY_PLACEHOLDER}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex mt-8">
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              disabled={busy || reply.trim() === ''}
              onClick={() => onAnalyzeReply(reply)}
            >
              Проанализировать ответ AI
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setReply('Мы можем разместить ссылку за $250.')}
            >
              Пример ответа
            </button>
          </div>
        </div>
      )}

      {analysis !== null && (
        <div className="negotiation mt-16">
          <div className="negotiation-intent">
            <span className="chip">
              Статус:{' '}
              <strong>{NEGOTIATION_INTENT_LABELS[analysis.intent] ?? analysis.intent}</strong>
            </span>
            <PriceRange range={analysis.recommendedPrice} />
          </div>
          <div className="outreach-field mt-8">
            <span className="outreach-hint">Предлагаемый ответ</span>
            <div className="outreach-text">{analysis.suggestedResponse}</div>
          </div>
          <div className="text-secondary" style={{ fontSize: 13, marginTop: 8 }}>
            <strong>Стратегия:</strong> {analysis.strategy}
          </div>
          {analysis.fallbackOption !== null && (
            <div className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
              <strong>Запасной вариант:</strong> {analysis.fallbackOption}
            </div>
          )}
          {analysis.risks.length > 0 && (
            <ul className="risk-list mt-8">
              {analysis.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}

          <div className="row-actions mt-16">
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={busy}
              onClick={() => onRespond({ agree: true })}
            >
              Согласиться
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              disabled={busy}
              onClick={() => onRespond({ agree: false })}
            >
              Отклонить
            </button>
            {status !== 'AGREED' && status !== 'REJECTED' && (
              <>
                <input
                  className="input"
                  style={{ width: 260 }}
                  placeholder="Свой ответ площадке (опционально)"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={busy || custom.trim() === ''}
                  onClick={() => onRespond({ agree: false, customResponse: custom })}
                >
                  Отправить свой ответ
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {negotiation !== null && negotiation.replies.length > 0 && (
        <div className="thread mt-16">
          {negotiation.replies.map((r, i) => (
            <div className={`thread-message ${r.role}`} key={i}>
              <span className="thread-role">
                {r.role === 'donor' ? 'Донор' : r.role === 'ai' ? 'AI' : 'Вы'}
              </span>
              <div>{r.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
