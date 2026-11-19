import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-workload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="page-head">
      <div><p class="eyebrow">PROJECT LEADERSHIP</p><h1>Team workload</h1><p>Balance open assignments across members in your projects.</p></div>
      <div class="summary"><strong>{{ activeAssignments() }}</strong><span>open assignments</span></div>
    </header>
    <section class="workload-list">
      @for (member of workload(); track member.user.id) {
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
          <a routerLink="/contributions" class="view-link">Review activity →</a>
        </article>
      } @empty {
        <div class="empty-state"><strong>No project members to compare</strong><span>Add students to a project and assign tasks to see workload here.</span></div>
      }
    </section>
  `,
  styles: [`
    :host { display:block; --card:var(--surface,#fff); --text:var(--text,#0f172a); --muted:var(--muted,#64748b); --line:var(--border,#e2e8f0); }
    .page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1.2rem; }
    .eyebrow { margin:0 0 .35rem; color:#6268e8; font-size:.66rem; font-weight:800; letter-spacing:.14em; }
    h1 { margin:0; color:var(--text); font-size:clamp(1.5rem,2.4vw,1.9rem); letter-spacing:-.04em; }
    .page-head p:last-child { margin:.35rem 0 0; color:var(--muted); font-size:.82rem; }
    .summary { display:grid; gap:.1rem; padding:.7rem .9rem; border:1px solid var(--line); border-radius:12px; background:var(--card); text-align:right; }
    .summary strong { color:var(--text); font-size:1.2rem; }
    .summary span { color:var(--muted); font-size:.7rem; }
    .workload-list { display:grid; gap:.7rem; }
    .member-row { display:grid; grid-template-columns:minmax(180px,.8fr) minmax(200px,1.4fr) auto; align-items:center; gap:1rem; padding:1rem 1.1rem; border:1px solid var(--line); border-radius:14px; background:var(--card); box-shadow:var(--shadow,0 6px 20px rgba(15,23,42,.035)); }
    .identity { display:flex; align-items:center; gap:.7rem; min-width:0; }
    .avatar { display:grid; width:40px; height:40px; place-items:center; flex:0 0 auto; border-radius:12px; background:#eef2ff; color:#4f46e5; font-size:.75rem; font-weight:800; }
    .identity div { display:grid; gap:.2rem; min-width:0; }
    .identity strong { overflow:hidden; color:var(--text); font-size:.85rem; text-overflow:ellipsis; white-space:nowrap; }
    .identity small { color:var(--muted); font-size:.7rem; text-transform:capitalize; }
    .load-info { display:grid; gap:.45rem; }
    .load-label { display:flex; justify-content:space-between; gap:.5rem; color:var(--muted); font-size:.72rem; }
    .load-label strong { color:var(--text); font-weight:700; }
    .track { height:7px; overflow:hidden; border-radius:999px; background:var(--surface-soft,#edf0f7); }
    .track span { display:block; height:100%; min-width:2px; border-radius:inherit; background:linear-gradient(90deg,#5965df,#8984f5); }
    .track span.high-load { background:linear-gradient(90deg,#f59e0b,#ef4444); }
    .view-link { color:#555fd0; font-size:.72rem; font-weight:700; text-decoration:none; white-space:nowrap; }
    .empty-state { display:grid; gap:.35rem; padding:3rem 1rem; border:1px dashed var(--line); border-radius:14px; color:var(--muted); text-align:center; font-size:.82rem; }
    .empty-state strong { color:var(--text); }
    @media(max-width:760px) { .member-row { grid-template-columns:1fr; } .view-link { justify-self:start; } }
    @media(max-width:520px) { .page-head { flex-direction:column; } .summary { width:100%; text-align:left; } }
  `]
})
export class WorkloadComponent {
  readonly data = inject(DataService);
  readonly workload = this.data.workload;
  readonly activeAssignments = computed(() => this.workload().reduce((sum, member) => sum + member.assigned, 0));

  initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  }
}
