import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { DeadlineItem } from '../../core/models/models';

type DeadlineFilter = 'all' | 'upcoming' | 'overdue';

@Component({
  selector: 'app-deadlines',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="page-head">
      <div><p class="eyebrow">KEEP WORK MOVING</p><h1>Deadlines</h1><p>Project dates and unfinished task due dates in your assigned work.</p></div>
      <a routerLink="/tasks" class="primary-link">Open tasks →</a>
    </header>

    <section class="summary">
      <article><span>All open dates</span><strong>{{ data.deadlines().length }}</strong></article>
      <article><span>Due in 7 days</span><strong>{{ upcomingCount() }}</strong></article>
      <article class="late"><span>Overdue</span><strong>{{ overdueCount() }}</strong></article>
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
          <article class="deadline-row" [class.overdue]="isOverdue(item)">
            <span class="date-block"><strong>{{ day(item.dueDate) }}</strong><small>{{ month(item.dueDate) }}</small></span>
            <div class="deadline-info"><strong>{{ item.title }}</strong><span>{{ item.projectTitle }} · {{ item.type }}</span></div>
            <span class="due-state" [class.overdue]="isOverdue(item)">{{ relativeDue(item.dueDate) }}</span>
            @if (item.type === 'task') { <a routerLink="/tasks" class="row-link">View task</a> }
            @else { <a routerLink="/projects" class="row-link">View project</a> }
          </article>
        } @empty {
          <div class="empty-state"><strong>{{ filter() === 'overdue' ? 'No overdue work' : 'No deadlines found' }}</strong><span>Dates for your projects and unfinished tasks will appear here.</span></div>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; --card:var(--surface,#fff); --text:var(--text,#0f172a); --muted:var(--muted,#64748b); --line:var(--border,#e2e8f0); }
    .page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1.15rem; }
    .eyebrow { margin:0 0 .35rem; color:#6268e8; font-size:.66rem; font-weight:800; letter-spacing:.14em; }
    h1 { margin:0; color:var(--text); font-size:clamp(1.5rem,2.4vw,1.9rem); letter-spacing:-.04em; }
    .page-head p:last-child { margin:.35rem 0 0; color:var(--muted); font-size:.82rem; }
    .primary-link { padding:.62rem .8rem; border-radius:9px; background:linear-gradient(135deg,#5661d8,#7c83ed); color:#fff; font-size:.76rem; font-weight:800; text-decoration:none; white-space:nowrap; }
    .summary { display:grid; grid-template-columns:repeat(3,1fr); gap:.75rem; margin-bottom:1rem; }
    .summary article { display:grid; gap:.3rem; padding:.9rem 1rem; border:1px solid var(--line); border-radius:13px; background:var(--card); }
    .summary span { color:var(--muted); font-size:.72rem; }
    .summary strong { color:var(--text); font-size:1.45rem; }
    .summary .late strong { color:#dc2626; }
    .deadline-panel { overflow:hidden; border:1px solid var(--line); border-radius:15px; background:var(--card); box-shadow:var(--shadow,0 6px 20px rgba(15,23,42,.035)); }
    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:.85rem 1rem; border-bottom:1px solid var(--line); }
    .filters { display:flex; gap:.25rem; }
    .filters button { border:0; border-radius:8px; background:transparent; color:var(--muted); padding:.48rem .65rem; font:inherit; font-size:.73rem; font-weight:700; cursor:pointer; }
    .filters button.active { background:var(--surface-soft,#eef2ff); color:#4f46e5; }
    .toolbar input { width:min(240px,45%); min-height:36px; border:1px solid var(--line); border-radius:8px; background:var(--input,#fff); color:var(--text); padding:.45rem .65rem; font:inherit; font-size:.76rem; }
    .deadline-row { display:grid; grid-template-columns:48px minmax(0,1fr) auto auto; align-items:center; gap:.85rem; padding:.8rem 1rem; border-bottom:1px solid var(--line); }
    .deadline-row:last-child { border-bottom:0; }
    .date-block { display:grid; width:44px; height:48px; place-content:center; border-radius:10px; background:#eef2ff; text-align:center; }
    .date-block strong { color:#4f46e5; font-size:1rem; line-height:1; }
    .date-block small { margin-top:.2rem; color:#6b7280; font-size:.63rem; text-transform:uppercase; }
    .deadline-info { display:grid; gap:.2rem; min-width:0; }
    .deadline-info strong { overflow:hidden; color:var(--text); font-size:.82rem; text-overflow:ellipsis; white-space:nowrap; }
    .deadline-info span { color:var(--muted); font-size:.7rem; text-transform:capitalize; }
    .due-state { padding:.3rem .5rem; border-radius:999px; background:#ecfdf5; color:#15803d; font-size:.68rem; font-weight:700; white-space:nowrap; }
    .due-state.overdue { background:#fef2f2; color:#b91c1c; }
    .row-link { color:#555fd0; font-size:.7rem; font-weight:700; text-decoration:none; white-space:nowrap; }
    .empty-state { display:grid; gap:.35rem; padding:2.5rem 1rem; color:var(--muted); text-align:center; font-size:.8rem; }
    .empty-state strong { color:var(--text); }
    @media(max-width:650px) {
      .page-head { flex-direction:column; }
      .summary { gap:.45rem; }
      .summary article { padding:.7rem; }
      .deadline-row { grid-template-columns:44px minmax(0,1fr) auto; gap:.6rem; }
      .row-link { grid-column:2/-1; }
      .toolbar { align-items:stretch; flex-direction:column; }
      .toolbar input { width:100%; }
    }
  `]
})
export class DeadlinesComponent {
  readonly data = inject(DataService);
  readonly filter = signal<DeadlineFilter>('all');
  readonly search = signal('');

  readonly upcomingCount = computed(() => this.data.deadlines().filter(item =>
    !this.isOverdue(item) && this.daysUntil(item.dueDate) <= 7
  ).length);
  readonly overdueCount = computed(() => this.data.deadlines().filter(item => this.isOverdue(item)).length);

  filteredDeadlines(): DeadlineItem[] {
    const query = this.search().trim().toLowerCase();
    return this.data.deadlines().filter(item => {
      const late = this.isOverdue(item);
      const matchesFilter = this.filter() === 'all'
        || (this.filter() === 'overdue' ? late : !late);
      const matchesSearch = !query
        || item.title.toLowerCase().includes(query)
        || item.projectTitle.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  isOverdue(item: DeadlineItem): boolean {
    return this.daysUntil(item.dueDate) < 0;
  }

  relativeDue(value: string): string {
    const days = this.daysUntil(value);
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

  private daysUntil(value: string): number {
    const due = new Date(`${value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / 86400000);
  }
}
