import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { DeadlineRiskService, RiskTier, RiskedDeadline } from '../../core/services/deadline-risk.service';
import { formatTime } from '../../core/utils/date-time';

type DeadlineFilter = 'all' | 'upcoming' | 'overdue';

const TIER_LABEL: Record<RiskTier, string> = {
  critical: 'Critical',
  at_risk: 'At risk',
  watch: 'Watch',
  clear: 'On track'
};

@Component({
  selector: 'app-deadlines',
  standalone: true,
  imports: [CommonModule, RouterLink],
  host: { '(window:focus)': 'refreshClock()' },
  template: `
    <header class="page-head">
      <div><p class="eyebrow">KEEP WORK MOVING</p><h1>Deadlines</h1></div>
      <a [routerLink]="workRoute()" [queryParams]="{ projectId: projectFilter() || null, taskId: taskFilter() || null }"
        class="primary-link">{{ workLabel() }} →</a>
    </header>
    @if (projectFilter() || taskFilter()) {
      <div class="context-filter">
        <span>{{ taskFilter() ? 'Showing the linked task deadline' : 'Showing dates for ' + projectTitle(projectFilter()) }}</span>
        <button type="button" (click)="clearContext()">Show all deadlines</button>
      </div>
    }

    <section class="summary">
      <article><span>All open dates</span><strong>{{ risk.risked().length }}</strong></article>
      <article><span>Due in 7 days</span><strong>{{ upcomingCount() }}</strong></article>
      <article class="late"><span>Overdue</span><strong>{{ overdueCount() }}</strong></article>
    </section>

    <section class="risk-strip" aria-label="Filter deadlines by risk">
      @for (tier of tiers; track tier) {
        <button type="button" class="risk-chip {{ tier }}"
          [class.active]="tierFilter() === tier"
          [attr.aria-pressed]="tierFilter() === tier"
          (click)="filterByTier(tier)">
          {{ tierLabel(tier) }} <strong>{{ risk.counts()[tier] }}</strong>
        </button>
      }
      @if (tierFilter() !== 'all') {
        <button type="button" class="tier-clear" (click)="tierFilter.set('all')">Clear filter ×</button>
      }
    </section>

    <section class="deadline-panel">
      <div class="toolbar">
        <div class="filters" role="group" aria-label="Filter deadlines">
          <button type="button" [class.active]="filter() === 'all'" (click)="filter.set('all')">All</button>
          <button type="button" [class.active]="filter() === 'upcoming'" (click)="filter.set('upcoming')">Upcoming</button>
          <button type="button" [class.active]="filter() === 'overdue'" (click)="filter.set('overdue')">Overdue</button>
        </div>
        <input type="search" [value]="search()" (input)="search.set(inputValue($event))" placeholder="Search deadlines" aria-label="Search deadlines" />
      </div>

      <div class="deadline-list">
        @for (item of filteredDeadlines(); track item.id) {
          <article class="deadline-row" [class.overdue]="item.daysLeft < 0">
            <span class="date-block"><strong>{{ day(item.dueDate) }}</strong><small>{{ month(item.dueDate) }}</small></span>
            <div class="deadline-info"><strong>{{ item.title }}</strong><span>{{ item.projectTitle }} · {{ item.type }}{{ item.dueTime ? ' · ' + clock(item.dueTime) : '' }}</span></div>
            <span class="risk-chip {{ item.tier }}">{{ tierLabel(item.tier) }}</span>
            <span class="due-state" [class.overdue]="item.daysLeft < 0">{{ relativeDue(item) }}</span>
            @if (item.type === 'task') {
              <a [routerLink]="taskRoute()" [queryParams]="{ projectId: item.projectId, taskId: item.id }" class="row-link">View task</a>
            } @else {
              <a routerLink="/projects" [queryParams]="{ projectId: item.projectId }" class="row-link">View project</a>
            }
          </article>
        } @empty {
          <div class="empty-state"><strong>{{ emptyTitle() }}</strong><span>{{ emptyCopy() }}</span></div>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; --card:var(--spms-surface,#fff); --text:var(--spms-text,var(--text)); --muted:var(--spms-muted,var(--muted)); --line:var(--spms-border,var(--border)); }
    .page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1.15rem; }
    .eyebrow { margin:0 0 .35rem; color:var(--accent); font-size:.66rem; font-weight:800; letter-spacing:.14em; }
    h1 { margin:0; color:var(--text); font-size:clamp(1.5rem,2.4vw,1.9rem); letter-spacing:-.04em; }
    .page-head p:last-child { margin:.35rem 0 0; color:var(--muted); font-size:.82rem; }
    .primary-link { padding:.62rem .9rem; border-radius:3px; background:var(--btn); color:#f7f1e1; font-size:.78rem; font-weight:600; text-decoration:none; white-space:nowrap; }
    .primary-link:hover { background:var(--btn-hover); }
    .context-filter { display:flex; align-items:center; gap:.65rem; margin:-.5rem 0 1rem; padding:.65rem .8rem; border:1px solid var(--line); border-radius:8px; background:var(--surface-2); color:var(--text); font-size:.78rem; }
    .context-filter button { margin-left:auto; border:0; padding:0; background:transparent; color:var(--accent); font:inherit; font-weight:700; cursor:pointer; }
    .summary { display:grid; grid-template-columns:repeat(3,1fr); gap:.75rem; margin-bottom:.75rem; }
    .summary article { display:grid; gap:.3rem; padding:.9rem 1rem; border:1px solid var(--line); border-radius:13px; background:var(--card); }
    .summary span { color:var(--muted); font-size:.72rem; }
    .summary strong { color:var(--text); font-size:1.45rem; }
    .summary .late strong { color:var(--danger); }
    .risk-strip { display:flex; flex-wrap:wrap; gap:.4rem; margin-bottom:1rem; }
    .risk-strip .risk-chip { cursor:pointer; transition:border-color .16s ease, background .16s ease, color .16s ease, transform .16s ease; }
    .risk-strip .risk-chip:hover { transform:translateY(-1px); border-color:currentColor !important; }
    .risk-strip .risk-chip.active { box-shadow:inset 0 0 0 1px currentColor; }
    .tier-clear { border:1px dashed var(--border); border-radius:2px; background:transparent; color:var(--muted); padding:.26rem .55rem; font-family:var(--font-mono); font-size:.58rem; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
    .tier-clear:hover { color:var(--accent); border-color:var(--accent); }
    .risk-chip { display:inline-flex; align-items:center; gap:.3rem; padding:.26rem .55rem; border:1px solid transparent; border-radius:999px; font:inherit; font-size:.66rem; font-weight:800; letter-spacing:.03em; text-transform:uppercase; white-space:nowrap; }
    .risk-chip.critical { background:var(--danger-soft); border-color:var(--danger-soft); color:var(--danger); }
    .risk-chip.at_risk { background:var(--accent-soft); border-color:var(--border); color:var(--ochre); }
    .risk-chip.watch { background:var(--surface-2); border-color:var(--border); color:var(--accent); }
    .risk-chip.clear { background:var(--surface-2); border-color:var(--border); color:var(--moss); }
    .deadline-panel { overflow:hidden; border:1px solid var(--line); border-radius:15px; background:var(--card); box-shadow:var(--shadow,0 6px 20px rgba(15,23,42,.035)); }
    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:.85rem 1rem; border-bottom:1px solid var(--line); }
    .filters { display:flex; gap:.25rem; }
    .filters button { border:0; border-radius:8px; background:transparent; color:var(--muted); padding:.48rem .65rem; font:inherit; font-size:.73rem; font-weight:700; cursor:pointer; }
    .filters button.active { background:var(--surface-soft,var(--surface-2)); color:var(--accent); }
    .toolbar input { width:min(240px,45%); min-height:36px; border:1px solid var(--line); border-radius:8px; background:var(--input,#fff); color:var(--text); padding:.45rem .65rem; font:inherit; font-size:.76rem; }
    .deadline-row { display:grid; grid-template-columns:48px minmax(0,1fr) auto auto auto; align-items:center; gap:.85rem; padding:.8rem 1rem; border-bottom:1px solid var(--line); }
    .deadline-row:last-child { border-bottom:0; }
    .date-block { display:grid; width:44px; height:48px; place-content:center; border-radius:10px; background:var(--surface-2); text-align:center; }
    .date-block strong { color:var(--accent); font-size:1rem; line-height:1; }
    .date-block small { margin-top:.2rem; color:#6b7280; font-size:.63rem; text-transform:uppercase; }
    .deadline-info { display:grid; gap:.2rem; min-width:0; }
    .deadline-info strong { overflow:hidden; color:var(--text); font-size:.82rem; text-overflow:ellipsis; white-space:nowrap; }
    .deadline-info span { color:var(--muted); font-size:.7rem; text-transform:capitalize; }
    .due-state { padding:.3rem .5rem; border-radius:999px; background:var(--surface-2); color:var(--moss); font-size:.68rem; font-weight:700; white-space:nowrap; }
    .due-state.overdue { background:var(--danger-soft); color:var(--danger); }
    .row-link { color:var(--accent); font-size:.7rem; font-weight:700; text-decoration:none; white-space:nowrap; }
    .empty-state { display:grid; gap:.35rem; padding:2.5rem 1rem; color:var(--muted); text-align:center; font-size:.8rem; }
    .empty-state strong { color:var(--text); }
    @media(max-width:650px) {
      .page-head { flex-direction:column; }
      .summary { gap:.45rem; }
      .summary article { padding:.7rem; }
      .deadline-row { grid-template-columns:44px minmax(0,1fr) auto; gap:.6rem; }
      .deadline-row > .risk-chip { display:none; }
      .row-link { grid-column:2/-1; }
      .toolbar { align-items:stretch; flex-direction:column; }
      .toolbar input { width:100%; }
    }
  `]
})
export class DeadlinesComponent {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  readonly risk = inject(DeadlineRiskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly filter = signal<DeadlineFilter>('all');
  readonly tierFilter = signal<RiskTier | 'all'>('all');
  readonly search = signal('');
  readonly projectFilter = signal('');
  readonly taskFilter = signal('');
  readonly tiers: readonly RiskTier[] = ['critical', 'at_risk', 'watch', 'clear'];

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.projectFilter.set(params.get('projectId') ?? '');
      this.taskFilter.set(params.get('taskId') ?? '');
      this.search.set(params.get('q') ?? '');
    });
  }

  readonly overdueCount = computed(() => this.risk.risked().filter(item => item.daysLeft < 0).length);

  readonly upcomingCount = computed(() =>
    this.risk.risked().filter(item => item.daysLeft >= 0 && item.daysLeft <= 7).length
  );

  readonly filteredDeadlines = computed<RiskedDeadline[]>(() => {
    const query = this.search().trim().toLowerCase();
    const mode = this.filter();
    const tier = this.tierFilter();
    return this.risk.risked().filter(item => {
      const matchesFilter = mode === 'all' || (mode === 'overdue' ? item.daysLeft < 0 : item.daysLeft >= 0);
      const matchesTier = tier === 'all' || item.tier === tier;
      const matchesProject = !this.projectFilter() || item.projectId === this.projectFilter();
      const matchesTask = !this.taskFilter() || item.id === this.taskFilter();
      const matchesSearch = !query
        || item.title.toLowerCase().includes(query)
        || item.projectTitle.toLowerCase().includes(query);
      return matchesFilter && matchesTier && matchesProject && matchesTask && matchesSearch;
    });
  });

  projectTitle(projectId: string): string {
    return this.data.projects().find(project => project.id === projectId)?.title ?? 'selected project';
  }

  clearContext(): void {
    this.projectFilter.set('');
    this.taskFilter.set('');
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { projectId: null, taskId: null, q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  refreshClock(): void {
    this.risk.refreshClock();
  }

  /** Risk chips are toggles: press to narrow the list, press again to clear. */
  filterByTier(tier: RiskTier): void {
    this.tierFilter.update(current => (current === tier ? 'all' : tier));
  }

  workRoute(): string {
    if (this.auth.hasRole('adviser')) return '/adviser';
    if (this.auth.hasRole('admin')) {
      return this.taskFilter() ? '/tasks' : this.projectFilter() ? '/projects' : '/admin';
    }
    return '/tasks';
  }

  workLabel(): string {
    if (this.taskFilter()) return 'Open linked task';
    if (this.projectFilter()) return 'Open linked project';
    if (this.auth.hasRole('adviser')) return 'Open reviews';
    if (this.auth.hasRole('admin')) return 'Open administration';
    return 'Open tasks';
  }

  taskRoute(): string {
    return '/tasks';
  }

  emptyTitle(): string {
    const tier = this.tierFilter();
    if (tier !== 'all') return `Nothing flagged ${TIER_LABEL[tier].toLowerCase()}`;
    return this.filter() === 'overdue' ? 'No overdue work' : 'No deadlines found';
  }

  emptyCopy(): string {
    return '';
  }

  tierLabel(tier: RiskTier): string {
    return TIER_LABEL[tier];
  }

  clock(value?: string): string {
    return formatTime(value);
  }

  relativeDue(item: RiskedDeadline): string {
    const days = item.daysLeft;
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `In ${days} days`;
  }

  day(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit' });
  }

  month(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short' });
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
