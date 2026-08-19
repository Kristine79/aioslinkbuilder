/**
 * Reusable metric badge that makes the data provenance explicit. Every value
 * from the backend carries a status (measured / AI estimate / internal /
 * synthetic / unknown); the UI must never present synthetic or unknown data
 * as a real measurement.
 */

import { METRIC_STATUS_LABELS, METRIC_STATUS_TONES } from '../ru';

export function MetricStatusTag({ status }: { status: string }) {
  return (
    <span
      className={`badge ${METRIC_STATUS_TONES[status] ?? 'tone-gray'}`}
      title="Происхождение данных"
    >
      {METRIC_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function MetricBadge({ status }: { status: string }) {
  return <MetricStatusTag status={status} />;
}

export function formatMetricValue<T>(value: T | null): string {
  if (value === null) return '—';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('ru-RU').format(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? '—' : value.join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return 'есть данные';
  }
  return String(value);
}
