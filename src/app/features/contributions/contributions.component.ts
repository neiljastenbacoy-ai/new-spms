import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ContributionSummary } from '../../core/models/models';

@Component({
  selector: 'app-contributions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ auth.hasRole('adviser') ? 'ADVISER REVIEW' : 'PROJECT ACTIVITY' }}</p>
        <h1>{{ auth.hasRole('student') ? 'My contributions' : 'Member participation' }}</h1>
      </div>
      <div class="scope-chip">
        {{ projectFilter() ? projectTitle(projectFilter()) : data.projects().length + ' assigned ' + (data.projects().length === 1 ? 'project' : 'projects') }}
      </div>
    </header>

    @if (memberFilter() || projectFilter() || search()) {
      <div class="context-filter">
        <span>{{ contextLabel() }}</span>
        <button type="button" (click)="clearContext()">Show all contributions</button>
      </div>
    }

    <section class="summary-grid" aria-label="Contribution summary">
      <article class="summary-card">
        <span>Tasks completed</span><strong>{{ totalCompleted() }}</strong>
      </article>
      <article class="summary-card">
        <span>Open assignments</span><strong>{{ totalOpen() }}</strong>
      </article>
      <article class="summary-card">
        <span>My shared files</span><strong>{{ totalFiles() }}</strong>
      </article>
      <article class="summary-card">
        <span>Recorded activities</span><strong>{{ totalActivities() }}</strong>
      </article>
    </section>

    <section class="section-card">
      <div class="section-title">
        <div><h2>{{ auth.hasRole('student') ? 'My activity' : 'Project member activity' }}</h2></div>
      </div>
      <div class="member-list">
        @for (member of visibleContributions(); track member.user.id) {
          <article class="member-card">
            <div class="member-head">
              <span class="avatar">{{ initials(member.user.name) }}</span>
              <div><h3>{{ member.user.name }}</h3><span>{{ roleLabel(member.user.role) }}</span></div>
              <strong class="completion">{{ completionRate(member) }}%<small>task completion</small></strong>
            </div>
            <div class="progress-track"><span [style.width.%]="completionRate(member)"></span></div>
            <div class="metrics">
              <span><strong>{{ member.completedTasks }}</strong> completed</span>
              <span><strong>{{ member.assignedTasks }}</strong> assigned</span>
              <span><strong>{{ member.filesUploaded }}</strong> shared files</span>
              <span><strong>{{ member.recordedActivities }}</strong> activities</span>
            </div>
          </article>
        } @empty {
          <div class="empty-state"><strong>{{ memberFilter() || projectFilter() || search() ? 'No matching contribution records' : 'No contribution records' }}</strong></div>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; --card:var(--spms-surface,#fff); --text:var(--spms-text,var(--text)); --muted:var(--spms-muted,var(--muted)); --line:var(--spms-border,var(--border)); }
    .page-head,.section-title { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
    .page-head { margin-bottom:1.2rem; }
    .eyebrow { margin:0 0 .35rem; color:var(--accent); font-size:.66rem; font-weight:800; letter-spacing:.14em; }
    h1 { margin:0; color:var(--text); font-size:clamp(1.5rem,2.4vw,1.9rem); letter-spacing:-.04em; }
    .page-head p,.section-title p { margin:.35rem 0 0; color:var(--muted); font-size:.82rem; }
    .context-filter { display:flex; align-items:center; gap:.65rem; margin:-.5rem 0 1rem; padding:.65rem .8rem; border:1px solid var(--line); border-radius:8px; background:var(--surface-2); color:var(--text); font-size:.78rem; }
    .context-filter button { margin-left:auto; border:0; padding:0; background:transparent; color:var(--accent); font:inherit; font-weight:700; cursor:pointer; }
    .scope-chip { border:1px solid var(--line); border-radius:999px; padding:.45rem .7rem; color:var(--muted); font-size:.75rem; font-weight:700; white-space:nowrap; }
    .summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.8rem; margin-bottom:1rem; }
    .summary-card,.section-card,.member-card { border:1px solid var(--line); border-radius:14px; background:var(--card); box-shadow:var(--shadow,0 6px 20px rgba(15,23,42,.035)); }
    .summary-card { display:grid; gap:.4rem; padding:1rem; }
    .summary-card span { color:var(--muted); font-size:.75rem; }
    .summary-card strong { color:var(--text); font-size:1.6rem; letter-spacing:-.04em; }
    .section-card { overflow:hidden; }
    .section-title { align-items:center; padding:1rem 1.15rem; border-bottom:1px solid var(--line); }
    h2 { margin:0; color:var(--text); font-size:.95rem; }
    .member-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:.8rem; padding:1rem; }
    .member-card { padding:1rem; }
    .member-head { display:flex; align-items:center; gap:.65rem; }
    .avatar { display:grid; width:38px; height:38px; place-items:center; flex:0 0 auto; border-radius:12px; background:var(--surface-2); color:var(--accent); font-size:.75rem; font-weight:800; }
    h3 { margin:0; color:var(--text); font-size:.86rem; }
    .member-head > div > span { display:block; margin-top:.2rem; color:var(--muted); font-size:.7rem; text-transform:capitalize; }
    .completion { display:grid; gap:.1rem; margin-left:auto; color:var(--accent); font-size:1rem; text-align:right; }
    .completion small { color:var(--muted); font-size:.62rem; font-weight:500; }
    .progress-track { height:6px; margin:1rem 0 .75rem; overflow:hidden; border-radius:999px; background:var(--surface-soft,#eef2f7); }
    .progress-track span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--accent),#8b7cf6); }
    .metrics { display:grid; grid-template-columns:repeat(2,1fr); gap:.5rem; }
    .metrics span { color:var(--muted); font-size:.7rem; }
    .metrics strong { color:var(--text); }
    .empty-state { display:grid; gap:.35rem; grid-column:1/-1; padding:2.5rem 1rem; text-align:center; color:var(--muted); font-size:.8rem; }
    .empty-state strong { color:var(--text); }
    @media(max-width:700px) { .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .page-head { flex-direction:column; } }
  `]
})
export class ContributionsComponent {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly contributions = this.data.contributions;
  readonly memberFilter = signal('');
  readonly projectFilter = signal('');
  readonly search = signal('');
  readonly visibleContributions = computed(() => {
    const memberId = this.memberFilter();
    const projectId = this.projectFilter();
    const query = this.search().trim().toLowerCase();
    const project = projectId ? this.data.projects().find(item => item.id === projectId) : undefined;
    if (projectId && !project) return [];
    const participants = project
      ? new Set([project.leaderId, ...(project.memberIds ?? [])])
      : null;
    const tasks = this.data.tasks();
    const files = this.data.files();
    const activities = this.data.activities();
    return this.contributions()
      .filter(item =>
        (!memberId || item.user.id === memberId)
        && (!participants || participants.has(item.user.id))
        && (!query || item.user.name.toLowerCase().includes(query))
      )
      .map(item => projectId ? {
        ...item,
        assignedTasks: tasks.filter(task => task.projectId === projectId && task.assigneeId === item.user.id).length,
        completedTasks: tasks.filter(task =>
          task.projectId === projectId && task.assigneeId === item.user.id && task.status === 'completed'
        ).length,
        filesUploaded: files.filter(file => file.projectId === projectId && file.uploadedBy === item.user.id).length,
        recordedActivities: activities.filter(activity =>
          activity.projectId === projectId && activity.userId === item.user.id
        ).length
      } : item);
  });

  readonly totalCompleted = computed(() => this.visibleContributions().reduce((sum, item) => sum + item.completedTasks, 0));
  readonly totalOpen = computed(() => this.visibleContributions().reduce((sum, item) => sum + item.assignedTasks - item.completedTasks, 0));
  readonly totalFiles = computed(() => this.visibleContributions().reduce((sum, item) => sum + item.filesUploaded, 0));
  readonly totalActivities = computed(() => this.visibleContributions().reduce((sum, item) => sum + item.recordedActivities, 0));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.memberFilter.set(params.get('memberId') ?? '');
      this.projectFilter.set(params.get('projectId') ?? '');
      this.search.set(params.get('q') ?? '');
    });
  }

  memberName(memberId: string): string {
    return this.data.team().find(member => member.id === memberId)?.name ?? 'selected member';
  }

  projectTitle(projectId: string): string {
    return this.data.projects().find(project => project.id === projectId)?.title ?? 'selected project';
  }

  contextLabel(): string {
    const filters = [
      this.memberFilter() ? this.memberName(this.memberFilter()) : '',
      this.projectFilter() ? this.projectTitle(this.projectFilter()) : '',
      this.search() ? `matching "${this.search()}"` : ''
    ].filter(Boolean);
    return `Showing ${filters.join(' · ')}`;
  }

  clearContext(): void {
    this.memberFilter.set('');
    this.projectFilter.set('');
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { memberId: null, projectId: null, q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  }

  completionRate(member: ContributionSummary): number {
    return member.assignedTasks ? Math.round((member.completedTasks / member.assignedTasks) * 100) : 0;
  }

  roleLabel(role: string): string {
    return role.replace('_', ' ');
  }
}
