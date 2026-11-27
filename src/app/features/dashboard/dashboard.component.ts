import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { formatTime } from '../../core/utils/date-time';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="hero">
      <div class="hero-text">
        <span class="hero-kicker"><i aria-hidden="true"></i>{{ roleLabel() }} workspace</span>
        <h1>{{ greeting() }},<br /><em>{{ firstName() }}.</em></h1>
        <a [routerLink]="primaryRoute()" class="btn-cta">
          {{ primaryAction() }} <span class="cta-arrow" aria-hidden="true">→</span>
        </a>
      </div>

      <aside class="hero-context">
        <span>Academic period</span>
        <strong>{{ academicPeriod() }}</strong>
        <small>Live record from your SPMS workspace</small>
        <div class="stamp">
          <b>{{ stats().totalProjects }}</b>
          <span>Projects<br />on file</span>
        </div>
      </aside>
    </section>

    <div class="stats">
      <a class="stat card-blue" [routerLink]="projectsRoute()" aria-label="Open projects">
        <span class="stat-index">01</span>
        <div class="stat-value">{{ stats().totalProjects }}</div>
        <div class="stat-label">{{ isAdmin() ? 'Total projects' : isStudent() ? 'Assigned projects' : isAdviser() ? 'Assigned projects' : 'Led projects' }}</div>
        <span class="stat-rule" aria-hidden="true"></span>
      </a>
      <a class="stat card-green" [routerLink]="taskRoute()" aria-label="Open completed tasks">
        <span class="stat-index">02</span>
        <div class="stat-value">{{ stats().completedTasks }}</div>
        <div class="stat-label">Tasks completed</div>
        <span class="stat-rule" aria-hidden="true"></span>
      </a>
      <a class="stat card-orange" [routerLink]="taskRoute()" aria-label="Open open tasks">
        <span class="stat-index">03</span>
        <div class="stat-value">{{ stats().pendingTasks }}</div>
        <div class="stat-label">Open tasks</div>
        <span class="stat-rule" aria-hidden="true"></span>
      </a>
      <a class="stat card-purple" [routerLink]="peopleRoute()" aria-label="Open members">
        <span class="stat-index">04</span>
        <div class="stat-value">{{ stats().teamMembers }}</div>
        <div class="stat-label">{{ isAdmin() ? 'User accounts' : 'Project members' }}</div>
        <span class="stat-rule" aria-hidden="true"></span>
      </a>
    </div>

    <div class="grid-3">
      <div class="panel">
        <div class="panel-head">
          <div><h3>Project status</h3><span class="panel-subtitle">Portfolio snapshot</span></div>
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
                <span class="w-name">{{ w.user.name }}</span>
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
          <div><h3>Upcoming deadlines</h3><span class="panel-subtitle">Soonest first</span></div>
          <a routerLink="/deadlines" class="link">View all →</a>
        </div>
        <ul class="deadline-list">
          @for (d of nextDeadlines(); track d.id) {
            <li>
              <a routerLink="/deadlines"
                [queryParams]="d.type === 'task' ? { projectId: d.projectId, taskId: d.id } : { projectId: d.projectId }"
                class="hit">
                <div class="d-icon" [class]="d.type">DUE</div>
                <div class="d-body">
                  <strong>{{ d.title }}</strong>
                  <span>{{ d.projectTitle }}</span>
                </div>
                <span class="d-when">
                  <span class="d-date" [class]="dateClass(d.dueDate)">{{ formatDate(d.dueDate) }}</span>
                  @if (d.dueTime) { <span class="d-time">{{ clock(d.dueTime) }}</span> }
                </span>
              </a>
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
          <div><h3>My projects</h3><span class="panel-subtitle">Progress by project</span></div>
          <select class="select-sm" [(ngModel)]="projectStatusFilter" aria-label="Filter projects by status">
            <option value="all">All status</option>
            <option value="ongoing">In progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On hold</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <ul class="project-list">
          @for (p of filteredProjects(); track p.id) {
            <li>
              <a routerLink="/projects" [queryParams]="{ projectId: p.id }" class="hit project-hit">
                <div class="p-icon" [style.color]="p.color">◆</div>
                <div class="p-body">
                  <strong>{{ p.title }}</strong>
                  <span class="status" [class]="p.status">{{ statusLabel(p.status) }}</span>
                </div>
                <div class="p-progress">
                  <div class="track"><div class="fill" [style.width.%]="p.progress" [style.background]="p.color"></div></div>
                  <span>{{ p.progress }}%</span>
                </div>
                <div class="p-avatars"><span class="av">+{{ p.memberIds.length }}</span></div>
              </a>
            </li>
          } @empty {
            <li class="empty-summary">No projects are assigned to your account yet.</li>
          }
        </ul>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div><h3>Recent activity</h3><span class="panel-subtitle">Latest recorded events</span></div>
          @if (isAdmin()) {
            <a routerLink="/admin" class="link">View audit →</a>
          } @else {
            <a routerLink="/projects" class="link">View projects →</a>
          }
        </div>
        <ul class="activity-list">
          @for (a of recentActivities(); track a.id) {
            <li>
              <a [routerLink]="activityRoute(a.projectId)" [queryParams]="a.projectId ? { projectId: a.projectId } : null"
                class="hit activity-hit">
                <span class="a-dot" [class]="a.type"></span>
                <div class="a-body">
                  <p>{{ a.message }}</p>
                  <time>{{ relativeTime(a.createdAt) }}</time>
                </div>
              </a>
            </li>
          } @empty {
            <li class="empty-summary">No recent activity</li>
          }
        </ul>
      </div>

    </div>
  `,
  styles: [`
    /* ------------------------------------------------------------- hero */
    .hero {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(220px, .55fr);
      gap: 1rem;
      min-height: 196px;
      margin-bottom: 1rem;
      padding: 1.6rem 1.75rem;
      overflow: hidden;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, .25);
      background:
        repeating-linear-gradient(135deg, rgba(244, 237, 220, .04) 0 1px, transparent 1px 10px),
        radial-gradient(120% 140% at 100% 0%, rgba(179, 132, 60, .18), transparent 58%),
        linear-gradient(112deg, #17392e 0%, #14332a 48%, #0d251e 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .07), 0 22px 40px -34px rgba(13, 36, 29, .9);
    }

    .hero-text {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: .55rem;
      max-width: 46rem;
    }

    .hero-kicker {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      font-family: var(--font-mono);
      font-size: .58rem;
      font-weight: 500;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: #d9c39a;
    }

    .hero-kicker i {
      width: 6px;
      height: 6px;
      background: var(--accent);
      border-radius: 50%;
      box-shadow: 0 0 0 3px rgba(224, 117, 71, .2);
    }

    .hero-text h1 {
      font-family: var(--font-display);
      font-size: clamp(2rem, 3.4vw, 2.9rem);
      font-weight: 400;
      line-height: .96;
      letter-spacing: -.045em;
      color: #f6efdd;
    }

    .hero-text h1 em {
      font-style: italic;
      font-weight: 400;
      color: #e0b784;
    }

    .hero-text p {
      max-width: 42ch;
      color: #b9c8ba;
      font-size: .88rem;
      line-height: 1.55;
    }

    .btn-cta {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      margin-top: .55rem;
      padding: .58rem 1.05rem;
      border-radius: 3px;
      background: #e3bb85;
      color: #14332a;
      font-size: .8rem;
      font-weight: 700;
      letter-spacing: .01em;
      transition: background .16s ease, transform .16s ease, box-shadow .16s ease;
    }

    .btn-cta:hover {
      background: #f3d3a4;
      transform: translateY(-1px);
      box-shadow: 0 10px 22px -14px rgba(0, 0, 0, .8);
    }

    .cta-arrow { font-size: .95rem; transition: transform .16s ease; }
    .btn-cta:hover .cta-arrow { transform: translateX(3px); }

    .hero-context {
      position: relative;
      z-index: 1;
      align-self: stretch;
      display: flex;
      flex-direction: column;
      gap: .3rem;
      padding: 1.05rem 1.1rem;
      border: 1px solid rgba(244, 237, 220, .22);
      border-radius: 3px;
      background: rgba(6, 20, 15, .32);
    }

    .hero-context > span {
      font-family: var(--font-mono);
      font-size: .54rem;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: #9db49d;
    }

    .hero-context > strong {
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 400;
      letter-spacing: -.02em;
      color: #f6efdd;
      line-height: 1.15;
    }

    .hero-context > small {
      font-size: .72rem;
      line-height: 1.4;
      color: #93a894;
    }

    .stamp {
      display: flex;
      align-items: center;
      gap: .6rem;
      margin-top: auto;
      padding-top: .7rem;
      border-top: 1px solid rgba(244, 237, 220, .16);
    }

    .stamp b {
      font-family: var(--font-display);
      font-size: 1.9rem;
      font-weight: 400;
      line-height: 1;
      color: #e3bb85;
    }

    .stamp span {
      font-family: var(--font-mono);
      font-size: .53rem;
      letter-spacing: .13em;
      line-height: 1.5;
      text-transform: uppercase;
      color: #9db49d;
    }

    /* ------------------------------------------------------------ stats */
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: .75rem;
      margin-bottom: 1rem;
    }

    .stat {
      position: relative;
      display: block;
      padding: 1rem 1.05rem .9rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--surface);
      transition: border-color .18s ease, transform .18s ease;
    }

    .stat:hover { border-color: var(--line-strong); transform: translateY(-2px); }

    .stat-index {
      display: block;
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .16em;
      color: var(--muted);
      margin-bottom: .7rem;
    }

    .stat-value {
      font-family: var(--font-display);
      font-size: 2.25rem;
      font-weight: 400;
      line-height: .9;
      letter-spacing: -.045em;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }

    .stat-label {
      margin-top: .45rem;
      font-size: .74rem;
      font-weight: 500;
      letter-spacing: .01em;
      color: var(--muted);
    }

    .stat-rule {
      position: absolute;
      left: 1.05rem;
      right: 1.05rem;
      bottom: 0;
      height: 2px;
      background: var(--moss);
      transform: scaleX(.28);
      transform-origin: left;
      transition: transform .3s cubic-bezier(.3, .8, .2, 1);
    }

    .stat:hover .stat-rule { transform: scaleX(1); }
    .card-green .stat-rule { background: var(--accent-2); }
    .card-orange .stat-rule { background: var(--accent); }
    .card-purple .stat-rule { background: var(--ink-soft); }

    /* ------------------------------------------------------------ layout */
    .grid-3 {
      display: grid;
      grid-template-columns: 1.35fr 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .grid-3.bottom { grid-template-columns: 1.25fr 1.05fr .85fr; }

    .panel {
      display: flex;
      flex-direction: column;
      padding: 1.05rem 1.15rem 1.15rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--surface);
    }

    .grid-3 > .panel { min-height: 100%; }

    /* ------------------------------------------------------- project status */
    .status-summary { display: grid; gap: .95rem; padding: .35rem 0 .2rem; }

    .status-line > div:first-child {
      display: flex;
      align-items: center;
      gap: .45rem;
      font-size: .78rem;
      color: var(--ink-soft);
    }

    .status-line strong {
      margin-left: auto;
      font-family: var(--font-mono);
      font-size: .72rem;
      font-weight: 500;
      color: var(--text);
    }

    .status-indicator { width: 7px; height: 7px; border-radius: 50%; background: var(--moss); }
    .status-indicator.on_hold { background: var(--ochre); }
    .status-indicator.completed { background: var(--rail); }
    .status-indicator.overdue { background: var(--accent); }

    .status-track { height: 3px; margin-top: .4rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
    .status-track span { display: block; height: 100%; background: var(--moss); }
    .status-track span.on_hold { background: var(--ochre); }
    .status-track span.completed { background: var(--rail); }
    .status-track span.overdue { background: var(--accent); }

    :host-context([data-theme='dark']) .status-track span.completed { background: var(--ochre); }

    /* --------------------------------------------------------- workload */
    .donut-wrap { display: flex; align-items: center; gap: 1rem; flex: 1; }

    .donut {
      position: relative;
      width: 104px;
      height: 104px;
      flex: 0 0 104px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--surface-2);
      box-shadow: inset 0 0 0 1px var(--border);
    }

    .donut::before {
      content: '';
      position: absolute;
      inset: 7px;
      border-radius: 50%;
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--border);
    }

    .donut::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1px dashed var(--line-strong);
      opacity: .55;
    }

    .donut-center {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.05;
    }

    .donut-center strong {
      font-family: var(--font-display);
      font-size: 1.6rem;
      font-weight: 400;
      letter-spacing: -.04em;
      color: var(--text);
    }

    .donut-center span {
      font-family: var(--font-mono);
      font-size: .5rem;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .workload-list { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 0; }

    .workload-list li {
      display: flex;
      align-items: center;
      gap: .45rem;
      padding: .32rem 0;
      border-bottom: 1px dotted var(--border);
      font-size: .76rem;
      color: var(--ink-soft);
    }

    .workload-list li:last-child { border-bottom: 0; }
    .w-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .workload-list strong {
      margin-left: auto;
      font-family: var(--font-mono);
      font-size: .64rem;
      font-weight: 500;
      color: var(--text);
      white-space: nowrap;
    }

    .empty-summary { padding: .9rem 0; color: var(--muted); font-size: .78rem; }

    /* --------------------------------------------------------- deadlines */
    .deadline-list, .project-list, .activity-list { list-style: none; margin: 0; padding: 0; flex: 1; }

    .deadline-list li,
    .project-list li,
    .activity-list li { border-bottom: 1px solid var(--border); }

    .deadline-list li:last-child,
    .project-list li:last-child,
    .activity-list li:last-child { border-bottom: 0; }

    .hit {
      display: flex;
      align-items: center;
      gap: .7rem;
      padding: .62rem .45rem;
      margin: 0 -.45rem;
      border-radius: 2px;
      transition: background-color .14s ease, box-shadow .14s ease;
    }

    .hit:hover { background: var(--hover); box-shadow: inset 2px 0 0 var(--accent); }
    .hit:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

    .d-icon {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: 2px;
      background: var(--surface-2);
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: .5rem;
      font-weight: 500;
      letter-spacing: .06em;
    }

    .d-body { flex: 1; min-width: 0; }

    .d-body strong {
      display: block;
      font-size: .8rem;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .d-body span { font-size: .7rem; color: var(--muted); }

    .d-when {
      display: grid;
      justify-items: end;
      gap: .05rem;
      flex: 0 0 auto;
    }

    .d-date {
      font-family: var(--font-mono);
      font-size: .58rem;
      letter-spacing: .04em;
      color: var(--muted);
      white-space: nowrap;
    }

    .d-time {
      font-family: var(--font-mono);
      font-size: .56rem;
      letter-spacing: .06em;
      color: var(--ink-soft);
      white-space: nowrap;
    }

    .d-date.soon { color: var(--danger); }
    .d-date.mid { color: var(--ochre); }
    .d-date.later { color: var(--muted); }

    /* ---------------------------------------------------------- projects */
    .project-hit {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: .7rem;
      padding: .65rem .45rem;
      margin: 0 -.45rem;
    }

    .p-icon {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: 2px;
      background: var(--surface-2);
      font-size: .7rem;
    }

    .p-body { min-width: 0; }

    .p-body strong {
      display: block;
      font-size: .8rem;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status {
      display: inline-block;
      margin-top: .2rem;
      font-family: var(--font-mono);
      font-size: .52rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .status.ongoing { color: var(--moss); }
    .status.on_hold { color: var(--ochre); }
    .status.completed { color: var(--rail); }
    .status.overdue { color: var(--danger); }

    :host-context([data-theme='dark']) .status.completed { color: var(--ochre); }

    .p-progress {
      display: flex;
      align-items: center;
      gap: .4rem;
      min-width: 86px;
      font-family: var(--font-mono);
      font-size: .58rem;
      color: var(--muted);
    }

    .track { width: 52px; height: 3px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; }

    .p-avatars .av {
      display: grid;
      place-items: center;
      min-width: 26px;
      height: 22px;
      padding: 0 .3rem;
      border: 1px solid var(--border);
      border-radius: 2px;
      background: var(--surface-2);
      color: var(--muted);
      font-family: var(--font-mono);
      font-size: .55rem;
    }

    /* ---------------------------------------------------------- activity */
    .activity-hit {
      display: flex;
      align-items: flex-start;
      gap: .65rem;
      padding: .6rem .45rem;
      margin: 0 -.45rem;
    }

    .a-dot { margin-top: .4rem; background: var(--moss); }
    .a-dot.task_assigned { background: var(--rail); }
    .a-dot.file_uploaded { background: var(--ochre); }
    .a-dot.file_downloaded { background: var(--moss); }
    .a-dot.comment { background: var(--accent-2); }
    .a-dot.status_update { background: var(--accent); }

    .a-body p { font-size: .78rem; line-height: 1.4; color: var(--ink-soft); }

    .a-body time {
      display: block;
      margin-top: .15rem;
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    /* ------------------------------------------------------------- promo */
    .promo {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: .5rem;
      padding: 1.35rem;
      overflow: hidden;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, .25);
      background:
        repeating-linear-gradient(135deg, rgba(244, 237, 220, .04) 0 1px, transparent 1px 10px),
        linear-gradient(150deg, #17392e 0%, #14332a 60%, #0d251e 100%);
      color: #f4eddc;
    }

    .promo-step {
      font-family: var(--font-mono);
      font-size: .55rem;
      font-weight: 500;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: #d9c39a;
    }

    .promo h3 {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 400;
      line-height: 1.2;
      letter-spacing: -.025em;
      color: #f6efdd;
    }

    .flow-list {
      list-style: none;
      margin: .2rem 0 0;
      padding: 0;
    }

    .flow-list li + li a { border-top: 1px solid rgba(244, 237, 220, .13); }

    .flow-list a {
      display: grid;
      grid-template-columns: 1.4rem minmax(0, 1fr) auto;
      align-items: center;
      gap: .6rem;
      padding: .48rem .3rem;
      border-radius: 2px;
      color: #f4eddc;
      transition: background-color .14s ease;
    }

    .flow-list a:hover { background: rgba(244, 237, 220, .08); }

    .flow-num {
      display: grid;
      place-items: center;
      width: 1.4rem;
      height: 1.4rem;
      border: 1px solid rgba(227, 187, 133, .42);
      border-radius: 2px;
      font-family: var(--font-mono);
      font-size: .55rem;
      color: #e3bb85;
    }

    .flow-copy {
      display: flex;
      flex-direction: column;
      gap: .04rem;
      min-width: 0;
    }

    .flow-copy strong {
      font-size: .75rem;
      font-weight: 600;
      color: #f6efdd;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .flow-copy small {
      font-family: var(--font-mono);
      font-size: .52rem;
      letter-spacing: .07em;
      text-transform: uppercase;
      color: #a9bcab;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .flow-arrow { color: #e3bb85; font-size: .8rem; opacity: .7; }
    .flow-list a:hover .flow-arrow { opacity: 1; }

    /* --------------------------------------------------------- responsive */
    @media (max-width: 1180px) {
      .grid-3,
      .grid-3.bottom { grid-template-columns: 1fr 1fr; }
      .grid-3.bottom > .promo { grid-column: span 2; }
    }

    @media (max-width: 1000px) {
      .hero { grid-template-columns: 1fr; padding: 1.4rem; }
      .hero-context { display: none; }
    }

    @media (max-width: 900px) {
      .stats { grid-template-columns: repeat(2, 1fr); }
      .grid-3,
      .grid-3.bottom { grid-template-columns: 1fr; }
      .grid-3.bottom > .promo { grid-column: auto; }
      .hero-text h1 { font-size: 1.9rem; }
    }

    @media (max-width: 560px) {
      .stats { grid-template-columns: 1fr; }
      .donut-wrap { flex-direction: column; align-items: flex-start; }
      .workload-list { width: 100%; }
    }
  `]
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  readonly data = inject(DataService);
  colors = ['#14332a', '#b04a2c', '#b3843c', '#4c6b4f', '#6b6c59', '#8a5b3a'];
  isStudent = computed(() => this.auth.hasRole('student'));
  isLeader = computed(() => this.auth.hasRole('project_leader'));
  isAdviser = computed(() => this.auth.hasRole('adviser'));
  isAdmin = computed(() => this.auth.hasRole('admin'));
  stats = this.data.stats;
  workload = this.data.workload;
  deadlines = this.data.deadlines;
  activities = this.data.activities;
  /** The dashboard shows the nearest dates only; the Deadlines page holds the full list. */
  readonly nextDeadlines = computed(() => this.deadlines().slice(0, 6));
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

  projectsRoute(): string {
    return '/projects';
  }

  taskRoute(): string {
    return '/tasks';
  }

  peopleRoute(): string {
    if (this.isAdmin()) return '/admin';
    if (this.isLeader()) return '/workload';
    return '/contributions';
  }

  activityRoute(projectId?: string): string {
    if (projectId) return this.isAdviser() ? '/adviser' : '/projects';
    if (this.isAdmin()) return '/admin';
    if (this.isAdviser()) return '/adviser';
    return '/projects';
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
    if (s === 'on_hold') return 'On hold';
    if (s === 'ongoing') return 'In progress';
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

  clock(value?: string): string {
    return formatTime(value);
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
