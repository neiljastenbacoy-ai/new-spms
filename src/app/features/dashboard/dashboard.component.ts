import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="hero">
      <div class="hero-text">
        <span class="hero-kicker">{{ roleLabel() }} workspace</span>
        <h1>{{ greeting() }}, {{ firstName() }}.</h1>
        <p>{{ roleDescription() }}</p>
        <a [routerLink]="primaryRoute()" class="btn-cta">{{ primaryAction() }} →</a>
      </div>
      <div class="hero-context">
        <span>ACADEMIC PERIOD</span>
        <strong>{{ academicPeriod() }}</strong>
        <small>Live information from your SPMS workspace</small>
      </div>
    </section>

    <div class="stats">
      <div class="stat card-blue">
        <div class="stat-icon">01</div>
        <div class="stat-body">
          <div class="stat-value">{{ stats().totalProjects }}</div>
          <div class="stat-label">{{ isAdmin() ? 'Total projects' : isStudent() ? 'Assigned projects' : isAdviser() ? 'Assigned projects' : 'Led projects' }}</div>
        </div>
      </div>
      <div class="stat card-green">
        <div class="stat-icon">02</div>
        <div class="stat-body">
          <div class="stat-value">{{ stats().completedTasks }}</div>
          <div class="stat-label">Tasks completed</div>
        </div>
      </div>
      <div class="stat card-orange">
        <div class="stat-icon">03</div>
        <div class="stat-body">
          <div class="stat-value">{{ stats().pendingTasks }}</div>
          <div class="stat-label">Open tasks</div>
        </div>
      </div>
      <div class="stat card-purple">
        <div class="stat-icon">04</div>
        <div class="stat-body">
          <div class="stat-value">{{ stats().teamMembers }}</div>
          <div class="stat-label">{{ isAdmin() ? 'User accounts' : 'Project members' }}</div>
        </div>
      </div>
    </div>

    <div class="grid-3">
      <div class="panel">
        <div class="panel-head">
          <div><h3>Project status</h3><span class="panel-subtitle">Current portfolio snapshot</span></div>
          <a routerLink="/projects" class="link">View projects →</a>
        </div>
        <div class="status-summary">
          @for (item of projectStatusCounts(); track item.status) {
            <div class="status-line">
              <div><span class="status-indicator" [class]="item.status"></span><span>{{ item.label }}</span><strong>{{ item.count }}</strong></div>
              <div class="status-track"><span [class]="item.status" [style.width.%]="item.percent"></span></div>
            </div>
          }
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div><h3>{{ isStudent() ? 'My work' : isAdviser() ? 'Student participation' : isAdmin() ? 'System access' : 'Team workload' }}</h3><span class="panel-subtitle">{{ isStudent() ? 'Your assigned task progress' : isAdviser() ? 'Teams in your assigned projects' : isAdmin() ? 'Accounts by access role' : 'Open tasks by member' }}</span></div>
          <a [routerLink]="isAdmin() ? '/admin' : isAdviser() || isStudent() ? '/contributions' : '/workload'" class="link">View details →</a>
        </div>
        <div class="donut-wrap">
          <div class="donut">
            <div class="donut-center">
              <strong>{{ isAdmin() ? data.team().length : isStudent() ? stats().completedTasks : data.workload().length }}</strong>
              <span>{{ isAdmin() ? 'Accounts' : isStudent() ? 'Done' : 'Members' }}</span>
            </div>
          </div>
          <ul class="workload-list">
            @for (w of teamSummary(); track w.user.id) {
              <li>
                <span class="dot" [style.background]="colors[$index % colors.length]"></span>
                {{ w.user.name }}
                <strong>{{ w.value }}</strong>
              </li>
            } @empty {
              <li class="empty-summary">No assigned activity yet.</li>
            }
          </ul>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h3>📅 Upcoming Deadlines</h3>
          <a routerLink="/deadlines" class="link">View All →</a>
        </div>
        <ul class="deadline-list">
          @for (d of deadlines(); track d.id) {
            <li>
              <div class="d-icon" [class]="d.type">📄</div>
              <div class="d-body">
                <strong>{{ d.title }}</strong>
                <span>{{ d.projectTitle }}</span>
              </div>
              <span class="d-date" [class]="dateClass(d.dueDate)">{{ formatDate(d.dueDate) }}</span>
            </li>
          } @empty {
            <li class="empty-summary">No deadlines in your assigned work.</li>
          }
        </ul>
      </div>
    </div>

    <div class="grid-3 bottom">
      <div class="panel">
        <div class="panel-head">
          <h3>▣ My Projects</h3>
          <select class="select-sm" [(ngModel)]="projectStatusFilter" aria-label="Filter projects by status">
            <option value="all">All status</option>
            <option value="ongoing">On Going</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <ul class="project-list">
          @for (p of filteredProjects(); track p.id) {
            <li>
              <div class="p-icon" [style.background]="p.color + '22'" [style.color]="p.color">◆</div>
              <div class="p-body">
                <strong>{{ p.title }}</strong>
                <span class="status" [class]="p.status">{{ statusLabel(p.status) }}</span>
              </div>
              <div class="p-progress">
                <div class="track"><div class="fill" [style.width.%]="p.progress" [style.background]="p.color"></div></div>
                <span>{{ p.progress }}%</span>
              </div>
              <div class="p-avatars">
                <span class="av">+{{ p.memberIds.length }}</span>
              </div>
            </li>
          } @empty {
            <li class="empty-summary">No projects are assigned to your account yet.</li>
          }
        </ul>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h3>⚡ Recent Activities</h3>
          @if (isAdmin()) {
            <a routerLink="/admin" class="link">View audit →</a>
          } @else {
            <a routerLink="/projects" class="link">View projects →</a>
          }
        </div>
        <ul class="activity-list">
          @for (a of recentActivities(); track a.id) {
            <li>
              <span class="a-dot" [class]="a.type"></span>
              <div class="a-body">
                <p>{{ a.message }}</p>
                <time>{{ relativeTime(a.createdAt) }}</time>
              </div>
            </li>
          } @empty {
            <li class="empty-summary">Project actions will appear here as work progresses.</li>
          }
        </ul>
      </div>

      <div class="promo">
        <span class="promo-step">YOUR NEXT STEP</span>
        <h3>{{ nextStepTitle() }}</h3>
        <p>{{ nextStepDescription() }}</p>
        <a [routerLink]="primaryRoute()" class="btn-promo">{{ primaryAction() }} →</a>
      </div>
    </div>
  `,
  styles: [`
    .hero {
      display: grid;
      grid-template-columns: 1.5fr 0.8fr;
      background: linear-gradient(120deg, #0f172a 0%, #1e3a8a 55%, #1e40af 100%);
      border-radius: 18px;
      overflow: hidden;
      min-height: 180px;
      margin-bottom: 1.25rem;
      color: #fff;
      position: relative;
    }
    .hero-text {
      padding: 1.75rem 2rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.5rem;
      z-index: 1;
    }
    .hero-text h1 {
      margin: 0;
      font-size: 1.65rem;
      font-weight: 700;
    }
    .hero-kicker,.promo-step { font-size:.68rem; font-weight:800; letter-spacing:.14em; color:#c7d2fe; text-transform:uppercase; }
    .hero-text p {
      margin: 0;
      opacity: 0.85;
      font-size: 0.95rem;
      max-width: 420px;
    }
    .btn-cta {
      display: inline-flex;
      align-items: center;
      margin-top: 0.75rem;
      padding: 0.65rem 1.25rem;
      background: #f59e0b;
      color: #0f172a;
      font-weight: 700;
      border-radius: 999px;
      text-decoration: none;
      width: fit-content;
      font-size: 0.9rem;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn-cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4);
    }
    .hero-context { align-self:center; display:grid; gap:.45rem; margin:1.25rem 1.4rem 1.25rem 0; padding:1rem 1.1rem; border:1px solid rgba(255,255,255,.15); border-radius:14px; background:rgba(255,255,255,.07); backdrop-filter:blur(8px); }
    .hero-context span { color:#c7d2fe; font-size:.65rem; font-weight:800; letter-spacing:.12em; }
    .hero-context strong { color:#fff; font-size:1rem; }
    .hero-context small { color:#cbd5e1; font-size:.72rem; }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .stat {
      border-radius: 16px;
      padding: 1.15rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      color: #fff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.08);
    }
    .card-blue { background: linear-gradient(135deg, #2563eb, #3b82f6); }
    .card-green { background: linear-gradient(135deg, #059669, #10b981); }
    .card-orange { background: linear-gradient(135deg, #d97706, #f59e0b); }
    .card-purple { background: linear-gradient(135deg, #7c3aed, #8b5cf6); }
    .stat-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255,255,255,0.2);
      display: grid;
      place-items: center;
      font-size: 1.2rem;
    }
    .stat-value {
      font-size: 1.6rem;
      font-weight: 800;
      line-height: 1.1;
    }
    .stat-label { font-size: 0.85rem; opacity: 0.9; }
    .delta { font-size: 0.75rem; font-weight: 600; margin-left: 0.25rem; }
    .delta.up { color: #bbf7d0; }

    .grid-3 {
      display: grid;
      grid-template-columns: 1.3fr 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .grid-3.bottom { grid-template-columns: 1.2fr 1.1fr 0.9fr; }

    .panel {
      background: #fff;
      border-radius: 16px;
      padding: 1.15rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      border: 1px solid #e2e8f0;
    }
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .panel-head h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
    }
    .panel-subtitle { display:block; margin-top:.22rem; color:#64748b; font-size:.72rem; }
    .status-summary { display:grid; gap:.95rem; padding:.25rem 0; }
    .status-line > div:first-child { display:flex; align-items:center; gap:.45rem; color:#475569; font-size:.8rem; }
    .status-line strong { margin-left:auto; color:#0f172a; font-size:.8rem; }
    .status-indicator { width:8px; height:8px; border-radius:50%; background:#6366f1; }
    .status-indicator.on_hold { background:#f59e0b; }
    .status-indicator.completed { background:#10b981; }
    .status-indicator.overdue { background:#ef4444; }
    .status-track { height:6px; margin-top:.42rem; overflow:hidden; border-radius:999px; background:#eef2f7; }
    .status-track span { display:block; height:100%; min-width:0; border-radius:inherit; background:#6366f1; }
    .status-track span.on_hold { background:#f59e0b; }
    .status-track span.completed { background:#10b981; }
    .status-track span.overdue { background:#ef4444; }
    .link {
      font-size: 0.8rem;
      color: #2563eb;
      text-decoration: none;
      font-weight: 500;
    }
    .select-sm {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.25rem 0.5rem;
      font-size: 0.8rem;
      background: #f8fafc;
    }

    .chart-bars {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 140px;
      gap: 0.5rem;
      padding: 0 0.25rem;
    }
    .bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; }
    .bars { display: flex; align-items: flex-end; gap: 3px; height: 120px; }
    .bar { width: 10px; border-radius: 4px 4px 0 0; min-height: 4px; }
    .bar.ongoing { background: #3b82f6; }
    .bar.completed { background: #10b981; }
    .bar.overdue { background: #ef4444; }
    .bar-label { font-size: 0.7rem; color: #64748b; }
    .legend {
      display: flex;
      gap: 1rem;
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: #64748b;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 0.3rem;
    }
    .dot.blue { background: #3b82f6; }
    .dot.green { background: #10b981; }
    .dot.red { background: #ef4444; }

    .donut-wrap {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .donut {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 7px solid #dfe3ff;
      background: var(--surface, #fff);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .donut-center {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--surface, #fff);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .donut-center strong { font-size: 1.15rem; color: var(--text, #0f172a); }
    .donut-center span { font-size: 0.65rem; color: #64748b; }
    .workload-list {
      list-style: none;
      padding: 0;
      margin: 0;
      flex: 1;
      font-size: 0.8rem;
    }
    .workload-list li {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0;
      color: #334155;
    }
    .workload-list strong { margin-left: auto; color: #0f172a; }
    .workload-list .empty-summary { color:#64748b; font-size:.78rem; }
    .empty-summary { padding:.85rem 0; color:#64748b; font-size:.8rem; }

    .deadline-list, .project-list, .activity-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .deadline-list li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.7rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .deadline-list li:last-child { border-bottom: none; }
    .d-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #eff6ff;
      display: grid;
      place-items: center;
      font-size: 0.9rem;
    }
    .d-body { flex: 1; min-width: 0; }
    .d-body strong { display: block; font-size: 0.85rem; color: #0f172a; }
    .d-body span { font-size: 0.75rem; color: #64748b; }
    .d-date {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      white-space: nowrap;
    }
    .d-date.soon { background: #fef2f2; color: #b91c1c; }
    .d-date.mid { background: #fff7ed; color: #c2410c; }
    .d-date.later { background: #eff6ff; color: #1d4ed8; }

    .project-list li {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .p-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-size: 1rem;
    }
    .p-body strong { display: block; font-size: 0.85rem; color: #0f172a; }
    .status {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 999px;
    }
    .status.ongoing { background: #dcfce7; color: #166534; }
    .status.on_hold { background: #ffedd5; color: #9a3412; }
    .status.completed { background: #dbeafe; color: #1e40af; }
    .p-progress {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      color: #64748b;
      min-width: 80px;
    }
    .track {
      width: 56px;
      height: 6px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .fill { height: 100%; border-radius: 999px; }
    .p-avatars .av {
      font-size: 0.7rem;
      background: #f1f5f9;
      padding: 0.2rem 0.45rem;
      border-radius: 999px;
      color: #475569;
    }

    .activity-list li {
      display: flex;
      gap: 0.75rem;
      padding: 0.65rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .a-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-top: 0.35rem;
      flex-shrink: 0;
    }
    .a-dot.task_assigned { background: #3b82f6; }
    .a-dot.file_uploaded { background: #10b981; }
    .a-dot.comment { background: #f59e0b; }
    .a-dot.status_update { background: #8b5cf6; }
    .a-body p { margin: 0; font-size: 0.82rem; color: #334155; line-height: 1.35; }
    .a-body time { font-size: 0.72rem; color: #94a3b8; }

    .promo {
      background: linear-gradient(145deg, #0f172a, #1e3a8a);
      border-radius: 16px;
      padding: 1.5rem;
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.75rem;
    }
    .promo h3 { margin: 0; font-size: 1.15rem; }
    .promo p { margin: 0; opacity: 0.85; font-size: 0.9rem; }
    .btn-promo {
      display: inline-flex;
      margin-top: 0.5rem;
      padding: 0.6rem 1.1rem;
      background: #3b82f6;
      color: #fff;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
      width: fit-content;
    }
    .promo-step { color:#c7d2fe; }

    @media (max-width: 1100px) {
      .stats { grid-template-columns: repeat(2, 1fr); }
      .grid-3, .grid-3.bottom { grid-template-columns: 1fr; }
      .hero { grid-template-columns: 1fr; }
      .hero-art { min-height: 100px; }
    }
  `]
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  readonly data = inject(DataService);
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
  isStudent = computed(() => this.auth.hasRole('student'));
  isLeader = computed(() => this.auth.hasRole('project_leader'));
  isAdviser = computed(() => this.auth.hasRole('adviser'));
  isAdmin = computed(() => this.auth.hasRole('admin'));
  stats = this.data.stats;
  workload = this.data.workload;
  deadlines = this.data.deadlines;
  activities = this.data.activities;
  projectStatusFilter = 'all';

  myProjects = computed(() => {
    const uid = this.auth.user()?.id;
    if (this.isAdmin() || !uid) return this.data.projects();
    return this.data.getProjectsByUser(uid);
  });

  filteredProjects() {
    if (this.projectStatusFilter === 'all') return this.myProjects();
    return this.myProjects().filter(project => project.status === this.projectStatusFilter);
  }

  recentActivities() {
    return this.activities().slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }

  firstName = computed(() => {
    const n = this.auth.user()?.name ?? 'there';
    return n.split(' ')[0];
  });

  greeting(): string {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  roleLabel(): string {
    if (this.isAdmin()) return 'Administrator';
    if (this.isAdviser()) return 'Instructor / Adviser';
    if (this.isLeader()) return 'Project Leader';
    return 'Student';
  }

  roleDescription(): string {
    if (this.isAdmin()) return 'Manage user access, review system activity, and keep SPMS settings current.';
    if (this.isAdviser()) return 'Review your assigned projects, check participation, and guide teams with feedback.';
    if (this.isLeader()) return 'Build your project team, assign work, and keep progress and deadlines on track.';
    return 'Pick up your assigned tasks, watch deadlines, and keep your project team moving.';
  }

  primaryRoute(): string {
    if (this.isAdmin()) return '/admin';
    if (this.isAdviser()) return '/adviser';
    if (this.isLeader()) return '/projects';
    return '/tasks';
  }

  primaryAction(): string {
    if (this.isAdmin()) return 'Manage SPMS';
    if (this.isAdviser()) return 'Review assigned projects';
    if (this.isLeader()) return 'Manage my projects';
    return 'Continue my tasks';
  }

  nextStepTitle(): string {
    if (this.isAdmin()) return 'Review access and recent changes';
    if (this.isAdviser()) return 'Review a team’s progress';
    if (this.isLeader()) return 'Check the team’s open work';
    return 'Update your next task';
  }

  nextStepDescription(): string {
    if (this.isAdmin()) return 'Keep accounts, registration, and academic settings up to date.';
    if (this.isAdviser()) return 'Open your assigned projects to check progress and leave feedback.';
    if (this.isLeader()) return 'Balance assignments and review each member’s contribution.';
    return 'Update task status and upload project files when your work is ready.';
  }

  academicPeriod(): string {
    const settings = this.data.systemSettings();
    return [settings.semester, settings.academicYear].filter(Boolean).join(' · ') || 'Not configured';
  }

  projectStatusCounts(): Array<{ status: string; label: string; count: number; percent: number }> {
    const projects = this.myProjects();
    const today = new Date().toISOString().slice(0, 10);
    const statuses = [
      { status: 'ongoing', label: 'In progress' },
      { status: 'on_hold', label: 'On hold' },
      { status: 'completed', label: 'Completed' },
      { status: 'overdue', label: 'Overdue' }
    ];
    return statuses.map(item => {
      const count = projects.filter(project => {
        const status = project.status === 'completed'
          ? 'completed'
          : project.status === 'on_hold'
            ? 'on_hold'
            : project.status === 'overdue' || (!!project.deadline && project.deadline < today)
              ? 'overdue'
              : 'ongoing';
        return status === item.status;
      }).length;
      return {
        ...item,
        count,
        percent: projects.length ? Math.round((count / projects.length) * 100) : 0
      };
    });
  }

  teamSummary(): Array<{ user: { id: string; name: string; role: string }; value: string }> {
    if (this.isAdmin()) {
      return this.data.team().slice(0, 5).map(user => ({
        user,
        value: user.role.replace('_', ' ')
      }));
    }
    if (this.isLeader()) {
      return this.workload().slice(0, 5).map(item => ({
        user: item.user,
        value: `${item.assigned} open`
      }));
    }
    return this.data.contributions().slice(0, 5).map(item => ({
      user: item.user,
      value: `${item.completedTasks}/${item.assignedTasks} done`
    }));
  }

  statusLabel(s: string): string {
    if (s === 'on_hold') return 'On Hold';
    if (s === 'ongoing') return 'On Going';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  dateClass(iso: string): string {
    const days = (new Date(iso).getTime() - Date.now()) / 86400000;
    if (days < 7) return 'soon';
    if (days < 14) return 'mid';
    return 'later';
  }

  relativeTime(iso: string): string {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.round(hrs / 24) + 'd ago';
  }
}
