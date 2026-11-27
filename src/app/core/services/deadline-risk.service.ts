import { computed, inject, Injectable, signal } from '@angular/core';
import { DataService } from './data.service';
import type { DeadlineItem } from '../models/models';
import { dueSortKey } from '../utils/date-time';

export type RiskTier = 'critical' | 'at_risk' | 'watch' | 'clear';

export interface RiskedDeadline extends DeadlineItem {
  /** Whole days until due. Negative = already past. */
  daysLeft: number;
  /** 0-100. Higher = more urgent. Deterministic, no randomness. */
  urgency: number;
  tier: RiskTier;
}

const MS_PER_DAY = 86_400_000;
/** Due dates are stored as `YYYY-MM-DD`; pin to UTC midnight so DST can't skew the diff. */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const startOfUtcDay = (value: Date | string): number => {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : value;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const daysBetween = (from: number, to: number): number => Math.round((to - from) / MS_PER_DAY);

/**
 * Urgency curve. Past-due items saturate at 100; the closer the deadline,
 * the steeper the slope. Type weight nudges defenses above routine tasks.
 */
const scoreUrgency = (daysLeft: number, type: DeadlineItem['type']): number => {
  if (!Number.isFinite(daysLeft)) return 0;
  if (daysLeft <= 0) return 100;
  const decay = 100 / (1 + daysLeft * 0.35);
  const weight = type === 'defense' ? 1.2 : type === 'report' ? 1.1 : 1;
  return Math.min(100, Math.round(decay * weight));
};

const tierFor = (daysLeft: number, urgency: number): RiskTier => {
  if (daysLeft < 0) return 'critical';
  if (daysLeft <= 2 || urgency >= 80) return 'critical';
  if (daysLeft <= 7 || urgency >= 60) return 'at_risk';
  if (daysLeft <= 21) return 'watch';
  return 'clear';
};

@Injectable({ providedIn: 'root' })
export class DeadlineRiskService {
  private readonly data = inject(DataService);
  /** Frozen clock — lets the UI re-score on demand without a running timer. */
  private readonly _today = signal(startOfUtcDay(new Date()));

  /** Call on app focus / route change to advance the risk clock. */
  refreshClock(): void {
    const today = startOfUtcDay(new Date());
    if (today !== this._today()) this._today.set(today);
  }

  readonly risked = computed<RiskedDeadline[]>(() => {
    const today = this._today();
    return this.data
      .deadlines()
      .filter(item => DAY_KEY.test(item.dueDate))
      .map(item => {
        const daysLeft = daysBetween(today, startOfUtcDay(item.dueDate));
        const urgency = scoreUrgency(daysLeft, item.type);
        return { ...item, daysLeft, urgency, tier: tierFor(daysLeft, urgency) };
      })
      .sort((a, b) =>
        b.urgency - a.urgency
        || dueSortKey(a.dueDate, a.dueTime).localeCompare(dueSortKey(b.dueDate, b.dueTime))
      );
  });

  readonly counts = computed<Record<RiskTier, number>>(() => {
    const counts: Record<RiskTier, number> = { critical: 0, at_risk: 0, watch: 0, clear: 0 };
    for (const item of this.risked()) counts[item.tier] += 1;
    return counts;
  });

  readonly nextUp = computed(() => this.risked().find(item => item.daysLeft >= 0) ?? null);
}
