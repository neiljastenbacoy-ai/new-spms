import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { DataService } from '../core/services/data.service';
import { formatDateTime } from '../core/utils/date-time';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <button class="mobile-menu" type="button" (click)="mobileMenu.set(!mobileMenu())" [attr.aria-expanded]="mobileMenu()">☰</button>

      @if (mobileMenu()) {
        <button class="scrim" type="button" aria-label="Close menu" (click)="mobileMenu.set(false)"></button>
      }

      <aside class="sidebar" [class.open]="mobileMenu()">
        <div class="brand">
          <span class="brand-mark">
            <img class="logo-mark" src="/spms-emblem.png" alt="SPMS emblem" />
          </span>
          <div class="brand-text">
            <strong>SPMS</strong>
            <span>Project register</span>
          </div>
        </div>

        <div class="nav-label"><span>Workspace</span></div>

        <nav>
          @for (item of navItems(); track item.path; let i = $index) {
            <a [routerLink]="item.path" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="idx">{{ navIndex(i) }}</span><span class="icon">{{ item.icon }}</span> {{ item.label }}
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <div class="record">
            <span class="record-label">Academic period</span>
            <strong>{{ data.systemSettings().academicYear || 'Not configured' }}</strong>
            <small>{{ roleLabel() }} workspace</small>
          </div>
          <div class="edge-code" aria-hidden="true">
            <span>USTP</span><span>SPMS</span><span>{{ today }}</span>
          </div>
        </div>

        <div class="user-chip" routerLink="/profile" routerLinkActive="profile-active">
          @if (user()?.photoUrl) {
            <img class="avatar" [src]="user()?.photoUrl" alt="Profile photo" />
          } @else {
            <div class="avatar">{{ initials() }}</div>
          }
          <div class="user-meta">
            <strong>{{ user()?.name }}</strong>
            <span>{{ roleLabel() }}</span>
          </div>
          <button class="logout-button" type="button" title="Sign out" aria-label="Sign out" (click)="logout(); $event.stopPropagation()">↪</button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="mobile-back" type="button" (click)="mobileMenu.set(true)" aria-label="Open menu">☰</button>

          <div class="search">
            <span class="search-icon">⌕</span>
            <input
              type="search"
              [(ngModel)]="searchQuery"
              (ngModelChange)="updateSearchResults()"
              (keydown.enter)="runSearch()"
              (keydown.escape)="searchResults.set([])"
              placeholder="Search projects, tasks, or members"
              aria-label="Search projects, tasks, or members"
            />
            <span class="search-hint">⌘K</span>
            @if (searchResults().length) {
              <div class="search-results">
                @for (result of searchResults(); track result.route + result.title) {
                  <button type="button" (click)="openSearchResult(result.route)">
                    <span class="result-icon">{{ result.icon }}</span>
                    <span>
                      <strong>{{ result.title }}</strong>
                      <small>{{ result.type }}</small>
                    </span>
                    <span class="result-arrow">→</span>
                  </button>
                }
              </div>
            }
          </div>

          <div class="top-actions">
            <span class="clock" aria-hidden="true">{{ today }}</span>
            <button class="icon-btn" title="Notifications" aria-label="Notifications" (click)="toggleNotifications()">
              <span class="bell">◉</span>
              @if (data.unreadNotificationCount()) {
                <span class="notice-count">{{ data.unreadNotificationCount() }}</span>
              }
            </button>
            <button class="icon-btn" title="Toggle theme" [attr.aria-label]="theme.isDark() ? 'Use light mode' : 'Use dark mode'" (click)="theme.toggle()">{{ theme.isDark() ? '☀' : '☾' }}</button>
            @if (user()?.photoUrl) {
              <a routerLink="/profile" class="profile-link" title="Profile settings"><img class="avatar-sm" [src]="user()?.photoUrl" alt="Profile" /></a>
            } @else {
              <a routerLink="/profile" class="avatar-sm profile-link" title="Profile settings">{{ initials() }}</a>
            }
            @if (notificationsOpen()) {
              <div class="notifications">
                <div class="notifications-head">
                  <strong>Notifications</strong>
                  <div class="notifications-actions">
                    @if (data.unreadNotificationCount()) {
                      <button type="button" class="mark-read" (click)="markAllRead()">Mark all read</button>
                    }
                    <button type="button" aria-label="Close notifications" (click)="notificationsOpen.set(false)">×</button>
                  </div>
                </div>
                @for (notice of noticeItems(); track notice.id) {
                  <button class="notice" type="button" [class.unread]="!notice.read" (click)="openNotice(notice)">
                    <b>{{ notice.title }}</b><span>{{ notice.description }}</span>
                  </button>
                } @empty {
                  <div class="notice empty-notice"><b>You’re all caught up</b><span>No upcoming deadlines or recent project updates.</span></div>
                }
              </div>
            }
          </div>
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }

    .shell {
      display: grid;
      grid-template-columns: 268px 1fr;
      height: 100vh;
      background: transparent;
    }

    /* ---------------------------------------------------------------- rail */
    .sidebar {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: .35rem;
      padding: 1.35rem 1rem 1rem;
      background:
        linear-gradient(180deg, rgba(255,255,255,.03), transparent 30%),
        repeating-linear-gradient(180deg, rgba(255,255,255,.022) 0 1px, transparent 1px 4px),
        var(--rail);
      color: var(--rail-ink);
      border-right: 1px solid rgba(0,0,0,.35);
      z-index: 4;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: .7rem;
      padding: .2rem .35rem 1.35rem;
      border-bottom: 1px solid rgba(233,225,205,.14);
      margin-bottom: .9rem;
    }

    .brand-mark {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      background: #f4eddc;
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgba(20,51,42,.18), 0 1px 0 rgba(0,0,0,.25);
    }

    .logo-mark {
      width: 32px;
      height: 32px;
      object-fit: contain;
      display: block;
    }

    .brand-text { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }

    .brand-text strong {
      font-family: var(--font-body);
      font-size: .92rem;
      font-weight: 700;
      letter-spacing: .26em;
      color: #f4eddc;
      line-height: 1;
    }

    .brand-text span {
      font-family: var(--font-mono);
      font-size: .56rem;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: var(--rail-muted);
    }

    .nav-label {
      display: flex;
      align-items: center;
      gap: .55rem;
      padding: 0 .6rem .45rem;
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .22em;
      text-transform: uppercase;
      color: #7f957f;
    }

    .nav-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(233,225,205,.14);
    }

    nav {
      display: flex;
      flex-direction: column;
      gap: .1rem;
      flex: 1;
      overflow-y: auto;
      padding-bottom: .5rem;
    }

    nav a {
      position: relative;
      display: grid;
      grid-template-columns: 1.5rem 1.1rem 1fr;
      align-items: center;
      gap: .55rem;
      min-height: 40px;
      padding: .5rem .6rem;
      border-radius: 3px;
      color: #b9c6b7;
      font-size: .83rem;
      font-weight: 500;
      letter-spacing: .005em;
    }

    nav a .idx {
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .06em;
      color: #6f8672;
      transition: color .16s ease;
    }

    nav a .icon {
      font-size: .95rem;
      line-height: 1;
      text-align: center;
      opacity: .85;
    }

    nav a:hover { background: rgba(233,225,205,.07); color: #f4eddc; }
    nav a:hover .idx { color: #d9c39a; }

    nav a.active {
      background: rgba(233,225,205,.11);
      color: #fdf8ea;
      box-shadow: inset 2px 0 0 var(--accent-2);
    }

    nav a.active .idx { color: var(--accent-2); }
    nav a.active .icon { opacity: 1; }

    .sidebar-footer {
      padding: .9rem .6rem 0;
      border-top: 1px solid rgba(233,225,205,.14);
      margin-top: .35rem;
    }

    .record {
      display: grid;
      gap: .18rem;
      padding: .6rem .65rem;
      border: 1px solid rgba(233,225,205,.16);
      border-radius: 3px;
      background: rgba(0,0,0,.14);
    }

    .record-label {
      font-family: var(--font-mono);
      font-size: .52rem;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: #8ba08b;
    }

    .record strong {
      font-family: var(--font-display);
      font-size: .92rem;
      font-weight: 500;
      letter-spacing: -.01em;
      color: #f4eddc;
      line-height: 1.15;
    }

    .record small {
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .06em;
      color: var(--accent-2);
    }

    .edge-code {
      display: flex;
      justify-content: space-between;
      gap: .5rem;
      margin-top: .6rem;
      font-family: var(--font-mono);
      font-size: .5rem;
      letter-spacing: .18em;
      color: #6f8672;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: .6rem;
      margin-top: .85rem;
      padding: .5rem .55rem;
      border: 1px solid rgba(233,225,205,.16);
      border-radius: 3px;
      background: rgba(0,0,0,.18);
      cursor: pointer;
      transition: border-color .16s ease, background .16s ease;
    }

    .user-chip:hover,
    .user-chip.profile-active {
      background: rgba(233,225,205,.09);
      border-color: rgba(233,225,205,.3);
    }

    .avatar,
    .avatar-sm {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      border-radius: 2px;
      background: #f4eddc;
      color: #14332a;
      font-family: var(--font-mono);
      font-size: .64rem;
      font-weight: 600;
      letter-spacing: .02em;
      object-fit: cover;
    }

    .avatar-sm { width: 32px; height: 32px; flex: 0 0 32px; }

    .user-chip .avatar,
    .top-actions .avatar-sm {
      background: #f4eddc !important;
      color: #14332a !important;
      border-radius: 2px !important;
      font-family: var(--font-mono) !important;
      font-size: .64rem !important;
    }

    .profile-link { border-radius: 2px; cursor: pointer; }

    .user-meta { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }

    .user-meta strong {
      font-size: .76rem;
      font-weight: 600;
      color: #f4eddc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-meta span {
      font-family: var(--font-mono);
      font-size: .52rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: #8ba08b;
    }

    .logout-button {
      margin-left: auto;
      width: 26px;
      height: 26px;
      flex: 0 0 26px;
      display: grid;
      place-items: center;
      border: 1px solid transparent;
      border-radius: 2px;
      background: transparent;
      color: #9db09d;
      font-size: .9rem;
      cursor: pointer;
    }

    .logout-button:hover {
      border-color: rgba(233,225,205,.24);
      background: rgba(176,74,44,.25);
      color: #f4d9cf;
    }

    /* ---------------------------------------------------------------- main */
    .main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }

    .topbar {
      position: relative;
      z-index: 30;
      flex: 0 0 66px;
      height: 66px;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0 1.6rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 1px 0 rgba(25,28,20,.03);
    }

    .search {
      position: relative;
      flex: 1;
      max-width: 460px;
    }

    .search-icon {
      position: absolute;
      left: .75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--muted);
      font-size: 1rem;
      pointer-events: none;
    }

    .search input {
      width: 100%;
      height: 38px;
      padding: 0 3.2rem 0 2.2rem;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: var(--field);
      color: var(--text);
      font-size: .82rem;
    }

    .search input::-webkit-search-cancel-button { display: none; }

    .search input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
      outline: none;
    }

    .search-hint {
      position: absolute;
      right: .5rem;
      top: 50%;
      transform: translateY(-50%);
      padding: .12rem .3rem;
      border: 1px solid var(--border);
      border-radius: 2px;
      font-family: var(--font-mono);
      font-size: .55rem;
      color: var(--muted);
      pointer-events: none;
    }

    .search-results {
      position: absolute;
      top: 46px;
      left: 0;
      right: 0;
      z-index: 100;
      max-height: 330px;
      overflow-y: auto;
      padding: .3rem;
      background: var(--surface);
      border: 1px solid var(--line-strong);
      border-radius: 4px;
      box-shadow: 0 26px 50px -26px rgba(25,28,20,.6);
    }

    .search-results button {
      width: 100%;
      min-height: 50px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: .7rem;
      padding: .5rem .6rem;
      border: 0;
      border-radius: 2px;
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }

    .search-results button:hover { background: var(--hover); }
    .search-results button > span:nth-child(2) { display: flex; flex-direction: column; }
    .search-results strong { font-size: .8rem; font-weight: 600; }

    .search-results small {
      margin-top: .1rem;
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .result-icon {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: 2px;
      background: var(--surface-2);
      color: var(--accent);
      font-size: .8rem;
    }

    .result-arrow { color: var(--muted); font-size: .85rem; }

    .top-actions {
      position: relative;
      display: flex;
      align-items: center;
      gap: .5rem;
      margin-left: auto;
    }

    .clock {
      font-family: var(--font-mono);
      font-size: .58rem;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--muted);
      padding-right: .6rem;
      border-right: 1px solid var(--border);
      margin-right: .1rem;
    }

    .icon-btn {
      position: relative;
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: var(--field);
      color: var(--ink-soft);
      font-size: .95rem;
      cursor: pointer;
    }

    .icon-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--surface);
    }

    .bell { line-height: 1; }

    .notice-count {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 16px;
      height: 16px;
      padding: 0 3px;
      display: grid;
      place-items: center;
      border-radius: 2px;
      border: 1px solid var(--surface);
      background: var(--accent);
      color: #fdf8ea;
      font-family: var(--font-mono);
      font-size: .55rem;
      font-weight: 600;
    }

    .top-actions .profile-link { display: grid; }

    .notifications {
      position: absolute;
      right: 0;
      top: calc(100% + 14px);
      width: 330px;
      overflow: hidden;
      background: var(--surface);
      border: 1px solid var(--line-strong);
      border-radius: 4px;
      box-shadow: 0 30px 60px -30px rgba(25,28,20,.65);
      z-index: 1000;
    }

    .notifications-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .7rem .85rem;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
    }

    .notifications-head strong {
      font-family: var(--font-mono);
      font-size: .58rem;
      font-weight: 500;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .notifications-head button {
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
    }
    .notifications-actions { display:flex; align-items:center; gap:.55rem; }
    .notifications-head .mark-read {
      padding:0;
      color:var(--accent);
      font:inherit;
      font-size:.68rem;
      font-weight:700;
    }

    .notice {
      display: flex;
      flex-direction: column;
      gap: .15rem;
      width: 100%;
      padding: .65rem .85rem;
      border: 0;
      border-bottom: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }

    .notice:last-child { border-bottom: 0; }
    .notice:hover { background: var(--hover); }
    .notice.unread { background: var(--accent-soft); }
    .notice b { font-size: .78rem; font-weight: 600; }
    .notice span { font-size: .72rem; color: var(--muted); }
    .empty-notice { cursor: default; }

    .content {
      flex: 1;
      width: 100%;
      max-width: 1600px;
      margin: 0 auto;
      overflow: auto;
      padding: 1.75rem 1.6rem 2.5rem;
    }

    .mobile-menu,
    .mobile-back,
    .scrim { display: none; }

    @media (max-width: 1100px) {
      .clock { display: none; }
    }

    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }

      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: 280px;
        max-width: 86vw;
        transform: translateX(-100%);
        transition: transform .24s cubic-bezier(.3,.7,.2,1);
        z-index: 60;
        box-shadow: 30px 0 60px -30px rgba(0,0,0,.8);
      }

      .sidebar.open { transform: translateX(0); }

      .scrim {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 50;
        border: 0;
        background: rgba(12,20,15,.5);
        backdrop-filter: blur(2px);
      }

      .topbar {
        height: 58px;
        flex-basis: 58px;
        padding: .5rem .75rem;
        gap: .5rem;
      }

      .mobile-back {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border: 1px solid var(--border);
        border-radius: 3px;
        background: var(--field);
        color: var(--text);
      }

      .search { max-width: none; }
      .search-hint { display: none; }
      .top-actions .avatar-sm { display: none; }
      .notifications { width: min(330px, calc(100vw - 20px)); }
      .content { padding: 1.05rem 1rem 2rem; }
    }
  `]
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly data = inject(DataService);
  readonly theme = inject(ThemeService);
  readonly mobileMenu = signal(false);
  readonly notificationsOpen = signal(false);
  user = this.auth.user;
  searchQuery = '';
  readonly today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  readonly searchResults = signal<Array<{
    title: string;
    type: string;
    route: string;
    icon: string;
    queryParams?: Record<string, string>;
  }>>([]);
  isStudent = computed(() => this.auth.hasRole('student'));
  isLeader = computed(() => this.auth.hasRole('project_leader'));
  isAdviserOnly = computed(() => this.auth.hasRole('adviser'));
  isAdmin = computed(() => this.auth.hasRole('admin'));

  /** Single source of truth for the rail: labels and access stay in step with the route guards. */
  readonly navItems = computed<Array<{ path: string; label: string; icon: string }>>(() => {
    const items: Array<{ path: string; label: string; icon: string }> = [
      { path: '/dashboard', label: 'Overview', icon: '⌂' }
    ];
    const student = this.isStudent();
    const leader = this.isLeader();
    const adviser = this.isAdviserOnly();
    const admin = this.isAdmin();

    if (student || leader || adviser || admin) {
      items.push({
        path: '/projects',
        label: student ? 'My project' : adviser ? 'Assigned projects' : admin ? 'All projects' : 'Projects & members',
        icon: '▣'
      });
    }
    if (student || leader || adviser || admin) {
      items.push({
        path: '/tasks',
        label: student ? 'My tasks' : adviser ? 'Task reviews' : admin ? 'All tasks' : 'Project tasks',
        icon: '☑'
      });
    }
    if (leader) {
      items.push({ path: '/workload', label: 'Workload', icon: '◉' });
    }
    if (student || leader || adviser) {
      items.push({ path: '/contributions', label: adviser ? 'Participation' : 'Contributions', icon: '♡' });
    }
    if (student || leader || adviser || admin) {
      items.push({ path: '/deadlines', label: 'Deadlines', icon: '◷' });
    }
    if (student || leader || adviser) {
      items.push({ path: '/files', label: 'Project files', icon: '▤' });
    }
    if (adviser) {
      items.push({ path: '/adviser', label: 'Review & feedback', icon: '◎' });
    }
    if (admin) {
      items.push({ path: '/admin', label: 'Administration', icon: '⚙' });
    }
    return items;
  });

  navIndex(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  readonly noticeItems = computed<Array<{
    id: string;
    title: string;
    description: string;
    route: string;
    queryParams?: Record<string, string>;
    date: string;
    notificationId: string;
    read: boolean;
  }>>(() => {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + 7);
    const todayKey = today.toISOString().slice(0, 10);

    const due = this.data.deadlines()
      .filter(item => new Date(`${item.dueDate}T00:00:00`) <= cutoff)
      .map(item => ({
        id: `deadline-${item.id}`,
        title: item.dueDate < todayKey ? 'Overdue item' : 'Upcoming deadline',
        description: `${item.title} · ${formatDateTime(item.dueDate, item.dueTime)}`,
        route: '/deadlines',
        queryParams: item.type === 'task'
          ? { projectId: item.projectId, taskId: item.id }
          : { projectId: item.projectId },
        date: item.dueDate,
        notificationId: '',
        read: true
      }));

    const activity = this.data.activities()
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map(item => ({
        id: `activity-${item.id}`,
        title: 'Project update',
        description: item.message,
        route: this.isAdviserOnly() ? '/adviser' : '/projects',
        queryParams: item.projectId ? { projectId: item.projectId } : undefined,
        date: item.createdAt,
        notificationId: '',
        read: true
      }));

    const account = this.data.notifications().map(item => ({
      id: `notification-${item.id}`,
      title: item.title,
      description: item.body,
      route: '/profile',
      date: item.createdAt,
      notificationId: item.id,
      read: item.read
    }));

    return [...account, ...due, ...activity]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
  });

  initials(): string {
    const n = this.user()?.name ?? '';
    return n.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  roleLabel(): string {
    const r = this.user()?.role;
    if (r === 'project_leader') return 'Project Leader';
    if (r === 'adviser') return 'Adviser';
    if (r === 'admin') return 'Administrator';
    return 'Student';
  }

  logout(): void {
    this.auth.logout();
  }

  runSearch(): void {
    const query = this.searchQuery.trim();
    if (!query) {
      this.searchResults.set([]);
      return;
    }
    if (this.searchResults().length) {
      const result = this.searchResults()[0];
      this.openSearchResult(result.route, result.queryParams);
      return;
    }
    const lower = query.toLowerCase();
    if (lower.includes('task')) {
      this.router.navigate(['/tasks'], { queryParams: { q: query } });
    }
    else if (lower.includes('work') || lower.includes('member') || lower.includes('contribution')) {
      const route = this.isLeader() ? '/workload' : this.isAdmin() ? '/admin' : '/contributions';
      this.router.navigate([route], { queryParams: { q: query } });
    }
    else if (lower.includes('deadline') || lower.includes('due')) {
      this.router.navigate(['/deadlines'], { queryParams: { q: query } });
    } else if (lower.includes('file') || lower.includes('document')) {
      const route = this.isAdmin() ? '/admin' : '/files';
      this.router.navigate([route], { queryParams: { q: query } });
    } else {
      this.router.navigate(['/projects'], { queryParams: { q: query } });
    }
  }

  updateSearchResults(): void {
    this.notificationsOpen.set(false);
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.searchResults.set([]);
      return;
    }

    const results: Array<{
      title: string;
      type: string;
      route: string;
      icon: string;
      queryParams?: Record<string, string>;
    }> = [];
    const projectRoute = '/projects';
    const taskRoute = '/tasks';
    this.data.projects().forEach(project => {
      if (project.title.toLowerCase().includes(query) || project.description.toLowerCase().includes(query)) {
        results.push({
          title: project.title,
          type: 'Project',
          route: projectRoute,
          icon: '▣',
          queryParams: { projectId: project.id }
        });
      }
    });
    this.data.tasks().forEach(task => {
      if (task.title.toLowerCase().includes(query)) {
        results.push({
          title: task.title,
          type: 'Task',
          route: taskRoute,
          icon: '☑',
          queryParams: { projectId: task.projectId, taskId: task.id }
        });
      }
    });
    this.data.team().forEach(member => {
      if (member.name.toLowerCase().includes(query)) {
        const route = this.isAdmin() ? '/admin' : this.isLeader() ? '/workload' : '/contributions';
        results.push({
          title: member.name,
          type: 'Team member',
          route,
          icon: '●',
          queryParams: { memberId: member.id }
        });
      }
    });
    this.searchResults.set(results.slice(0, 8));
  }

  openSearchResult(route: string, queryParams?: Record<string, string>): void {
    this.searchResults.set([]);
    this.notificationsOpen.set(false);
    this.searchQuery = '';
    void this.router.navigate([route], { queryParams });
  }

  async openNotice(notice: { route: string; notificationId: string; queryParams?: Record<string, string> }): Promise<void> {
    if (notice.notificationId) {
      try {
        await this.data.markNotificationRead(notice.notificationId);
      } catch (error) {
        console.error('Unable to mark the notification as read.', error);
      }
    }
    this.openSearchResult(notice.route, notice.queryParams);
  }

  async markAllRead(): Promise<void> {
    try {
      await this.data.markAllNotificationsRead();
    } catch (error) {
      console.error('Unable to mark notifications as read.', error);
    }
  }

  toggleNotifications(): void {
    this.searchResults.set([]);
    this.notificationsOpen.update(open => !open);
  }
}
