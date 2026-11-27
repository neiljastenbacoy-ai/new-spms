import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-workload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="page-head">
      <div><p class="eyebrow">PROJECT LEADERSHIP</p><h1>Team workload</h1></div>
      <div class="summary"><strong>{{ activeAssignments() }}</strong><span>open assignments</span></div>
    </header>
    @if (memberFilter() || search()) {
      <div class="context-filter">
        <span>{{ memberFilter() ? 'Focused on ' + memberName(memberFilter()) : 'Search: ' + search() }}</span>
        <button type="button" (click)="clearContext()">Show all members</button>
      </div>
    }
    <section class="workload-list">
      @for (member of visibleWorkload(); track member.user.id) {
        <article class="member-row">
          <div class="identity">
            <span class="avatar">{{ initials(member.user.name) }}</span>
            <div><strong>{{ member.user.name }}</strong><small>{{ member.user.role.replace('_', ' ') }}</small></div>
          </div>
          <div class="load-info">
            <div class="load-label"><span>{{ member.assigned }} open {{ member.assigned === 1 ? 'task' : 'tasks' }}</span><strong>{{ member.load }}% of open work</strong></div>
            <div class="track" role="progressbar" [attr.aria-valuenow]="member.load" aria-valuemin="0" aria-valuemax="100">
              <span [class.high-load]="member.load >= 40" [style.width.%]="member.load"></span>
            </div>
          </div>
          <a [routerLink]="['/contributions']" [queryParams]="{ memberId: member.user.id }" class="view-link">Review activity →</a>
        </article>
      } @empty {
        <div class="empty-state"><strong>No project members to compare</strong><span>Add students to a project and assign tasks to see workload here.</span></div>
      }
    </section>
  `,
  styles: [`
    :host { display:block; --card:var(--spms-surface,#fff); --text:var(--spms-text,var(--text)); --muted:var(--spms-muted,var(--muted)); --line:var(--spms-border,var(--border)); }
    .page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1.2rem; }
    .eyebrow { margin:0 0 .35rem; color:var(--accent); font-size:.66rem; font-weight:800; letter-spacing:.14em; }
    h1 { margin:0; color:var(--text); font-size:clamp(1.5rem,2.4vw,1.9rem); letter-spacing:-.04em; }
    .page-head p:last-child { margin:.35rem 0 0; color:var(--muted); font-size:.82rem; }
    .context-filter { display:flex; align-items:center; gap:.65rem; margin:-.5rem 0 1rem; padding:.65rem .8rem; border:1px solid var(--line); border-radius:8px; background:var(--surface-2); color:var(--text); font-size:.78rem; }
    .context-filter button { margin-left:auto; border:0; padding:0; background:transparent; color:var(--accent); font:inherit; font-weight:700; cursor:pointer; }
    .summary { display:grid; gap:.1rem; padding:.7rem .9rem; border:1px solid var(--line); border-radius:12px; background:var(--card); text-align:right; }
    .summary strong { color:var(--text); font-size:1.2rem; }
    .summary span { color:var(--muted); font-size:.7rem; }
    .workload-list { display:grid; gap:.7rem; }
    .member-row { display:grid; grid-template-columns:minmax(180px,.8fr) minmax(200px,1.4fr) auto; align-items:center; gap:1rem; padding:1rem 1.1rem; border:1px solid var(--line); border-radius:14px; background:var(--card); box-shadow:var(--shadow,0 6px 20px rgba(15,23,42,.035)); }
    .identity { display:flex; align-items:center; gap:.7rem; min-width:0; }
    .avatar { display:grid; width:40px; height:40px; place-items:center; flex:0 0 auto; border-radius:12px; background:var(--surface-2); color:var(--accent); font-size:.75rem; font-weight:800; }
    .identity div { display:grid; gap:.2rem; min-width:0; }
    .identity strong { overflow:hidden; color:var(--text); font-size:.85rem; text-overflow:ellipsis; white-space:nowrap; }
    .identity small { color:var(--muted); font-size:.7rem; text-transform:capitalize; }
    .load-info { display:grid; gap:.45rem; }
    .load-label { display:flex; justify-content:space-between; gap:.5rem; color:var(--muted); font-size:.72rem; }
    .load-label strong { color:var(--text); font-weight:700; }
    .track { height:7px; overflow:hidden; border-radius:999px; background:var(--surface-soft,var(--surface-2)); }
    .track span { display:block; height:100%; min-width:2px; border-radius:inherit; background:linear-gradient(90deg,var(--accent),var(--accent)); }
    .track span.high-load { background:linear-gradient(90deg,var(--ochre),var(--danger)); }
    .view-link { color:var(--accent); font-size:.72rem; font-weight:700; text-decoration:none; white-space:nowrap; }
    .empty-state { display:grid; gap:.35rem; padding:3rem 1rem; border:1px dashed var(--line); border-radius:14px; color:var(--muted); text-align:center; font-size:.82rem; }
    .empty-state strong { color:var(--text); }
    @media(max-width:760px) { .member-row { grid-template-columns:1fr; } .view-link { justify-self:start; } }
    @media(max-width:520px) { .page-head { flex-direction:column; } .summary { width:100%; text-align:left; } }
  `]
})
export class WorkloadComponent {
  readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly workload = this.data.workload;
  readonly memberFilter = signal('');
  readonly search = signal('');
  readonly visibleWorkload = computed(() => {
    const memberId = this.memberFilter();
    const query = this.search().trim().toLowerCase();
    return this.workload().filter(member =>
      (!memberId || member.user.id === memberId)
      && (!query || member.user.name.toLowerCase().includes(query))
    );
  });
  readonly activeAssignments = computed(() => this.visibleWorkload().reduce((sum, member) => sum + member.assigned, 0));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.memberFilter.set(params.get('memberId') ?? '');
      this.search.set(params.get('q') ?? '');
    });
  }

  memberName(memberId: string): string {
    return this.data.team().find(member => member.id === memberId)?.name ?? 'selected member';
  }

  clearContext(): void {
    this.memberFilter.set('');
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { memberId: null, q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  }
}
