/**
 * Small shared UI components. Presentation only — no business logic.
 */

import type { ReactNode } from 'react';

import type { PlacementStatus, VerificationStatus } from '../api/types';
import { STATUS_LABELS, VERIFICATION_LABELS } from '../ru';

const STATUS_TONES: Record<PlacementStatus, string> = {
  DISCOVERED: 'tone-gray',
  QUALIFIED: 'tone-blue',
  SELECTED: 'tone-indigo',
  READY: 'tone-indigo',
  SUBMITTED: 'tone-blue',
  PENDING_PUBLICATION: 'tone-amber',
  PUBLISHED: 'tone-teal',
  VERIFIED: 'tone-green',
  FAILED: 'tone-red',
  BLOCKED: 'tone-red',
  NEEDS_MANUAL: 'tone-amber',
  VERIFICATION_FAILED: 'tone-red',
  REJECTED: 'tone-red',
};

export function StatusBadge({ status }: { status: PlacementStatus }) {
  return (
    <span className={`badge ${STATUS_TONES[status] ?? 'tone-gray'}`}>
      <span className="badge-dot" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const tone = status === 'PASSED' ? 'tone-green' : status === 'FAILED' ? 'tone-red' : 'tone-gray';
  return (
    <span className={`badge ${tone}`}>
      {status === 'PASSED' ? '✓' : status === 'FAILED' ? '✕' : '·'}
      {VERIFICATION_LABELS[status]}
    </span>
  );
}

export function Chip({
  children,
  unverified = false,
}: {
  children: ReactNode;
  unverified?: boolean;
}) {
  return <span className={`chip ${unverified ? 'chip-unverified' : ''}`}>{children}</span>;
}

export function ChipList({ children }: { children: ReactNode }) {
  return <span className="chip-list">{children}</span>;
}

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title !== undefined || actions !== undefined) && (
        <div className="card-header">
          <div className="card-title" style={{ flex: 1 }}>
            {title}
          </div>
          {actions}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function StatCard({
  value,
  label,
  hint,
  link,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  link?: { to: string; text: string };
}) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint !== undefined && <div className="stat-hint">{hint}</div>}
      {link !== undefined && (
        <a className="stat-link" href={link.to}>
          {link.text}
        </a>
      )}
    </div>
  );
}

export function LoadingState({ text = 'Загрузка…' }: { text?: string }) {
  return (
    <div className="state-box">
      <div className="spinner" />
      <div className="state-box-title">{text}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-box">
      <div className="state-box-icon">⚠</div>
      <div className="state-box-title">Не удалось загрузить данные</div>
      <div className="state-box-hint">{message}</div>
      {onRetry !== undefined && (
        <button className="btn btn-secondary mt-16" type="button" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="state-box">
      <div className="state-box-icon">◌</div>
      <div className="state-box-title">{title}</div>
      {hint !== undefined && <div className="state-box-hint">{hint}</div>}
    </div>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success';
  children: ReactNode;
}) {
  return <div className={`alert alert-${tone}`}>{children}</div>;
}
