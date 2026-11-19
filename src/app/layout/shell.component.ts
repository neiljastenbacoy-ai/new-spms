import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { DataService } from '../core/services/data.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <button class="mobile-menu" type="button" (click)="mobileMenu.set(!mobileMenu())" [attr.aria-expanded]="mobileMenu()">☰</button>
      <aside class="sidebar" [class.open]="mobileMenu()">
        <div class="brand">
          <img class="logo-mark" src="/spms-emblem.png" alt="SPMS emblem" />
          <div class="brand-text">
            <strong>SPMS</strong>
            <span>PROJECT HUB</span>
          </div>
        </div>

        <nav>
          <a routerLink="/dashboard" routerLinkActive="active" (click)="mobileMenu.set(false)">
            <span class="icon">⌂</span> Overview
          </a>
          @if (isStudent() || isLeader() || isAdviserOnly()) {
            <a routerLink="/projects" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="icon">▣</span> {{ isStudent() ? 'My Project' : isAdviserOnly() ? 'Assigned Projects' : 'Projects & Members' }}
            </a>
          }
          @if (isStudent() || isLeader()) {
            <a routerLink="/tasks" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="icon">☑</span> {{ isStudent() ? 'My Tasks' : 'Tasks & Deadlines' }}
            </a>
          }
          @if (isLeader()) {
            <a routerLink="/workload" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="icon">◉</span> Workload
            </a>
          }
          @if (isStudent() || isLeader() || isAdviserOnly()) {
            <a routerLink="/contributions" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="icon">♡</span> {{ isAdviserOnly() ? 'Participation' : 'Contributions' }}
            </a>
          }
          @if (!isAdmin()) {
            <a routerLink="/deadlines" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="icon">◷</span> Deadlines
            </a>
          }
          @if (isStudent() || isLeader() || isAdviserOnly()) {
            <a routerLink="/files" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="icon">▤</span> Project Files
            </a>
          }
          @if (isAdviserOnly()) {
            <a routerLink="/adviser" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="icon">◎</span> Review & Feedback
            </a>
          }
          @if (isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active" (click)="mobileMenu.set(false)">
              <span class="icon">⚙</span> Administration
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <div class="system-name">SPMS<br /><small>{{ data.systemSettings().academicYear || 'Academic workspace' }}</small></div>
          <div class="tagline">{{ roleLabel() }} workspace</div>
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
          <button class="logout-button" type="button" title="Sign out" (click)="logout(); $event.stopPropagation()">↪</button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="mobile-back" type="button" (click)="mobileMenu.set(true)">☰</button>
          <div class="search">
            <span class="search-icon">⌕</span>
            <input type="search" [(ngModel)]="searchQuery" (ngModelChange)="updateSearchResults()" (keydown.enter)="runSearch()" (keydown.escape)="searchResults.set([])" placeholder="Search projects, tasks, or members..." />
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
            <button class="icon-btn" title="Notifications" aria-label="Notifications" (click)="toggleNotifications()">
              🔔
              @if (noticeItems().length) { <span class="badge">{{ noticeItems().length }}</span> }
            </button>
            <button class="icon-btn" title="Toggle theme" (click)="theme.toggle()">{{ theme.isDark() ? '☀' : '☾' }}</button>
            @if (user()?.photoUrl) {
              <a routerLink="/profile" class="profile-link" title="Profile settings"><img class="avatar-sm" [src]="user()?.photoUrl" alt="Profile" /></a>
            } @else {
              <a routerLink="/profile" class="avatar-sm profile-link" title="Profile settings">{{ initials() }}</a>
            }
            @if (notificationsOpen()) {
              <div class="notifications">
                <div class="notifications-head"><strong>Upcoming work</strong><button type="button" aria-label="Close notifications" (click)="notificationsOpen.set(false)">×</button></div>
                @for (notice of noticeItems(); track notice.id) {
                  <button class="notice" type="button" (click)="openSearchResult(notice.route)">
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
    :host { display: block; height: 100vh; --surface: #fff; --text: #0f172a; --muted: #64748b; --border: #e2e8f0; --content-bg: #f1f5f9; }
    :host-context([data-theme="dark"]) { --surface: #111827; --text: #f8fafc; --muted: #94a3b8; --border: #263244; --content-bg: #0b1220; }
    .shell {
      display: grid;
      grid-template-columns: 240px 1fr;
      height: 100vh;
      background: var(--content-bg);
    }
    .sidebar {
      background: linear-gradient(180deg, #0b1a3a 0%, #0f274f 100%);
      color: #e2e8f0;
      display: flex;
      flex-direction: column;
      padding: 1.25rem 0.85rem;
      gap: 0.5rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.6rem 1.25rem;
    }
    .logo-mark {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, #f59e0b, #fbbf24);
      color: #0f172a;
      font-weight: 800;
      font-size: 0.7rem;
      display: grid;
      place-items: center;
      letter-spacing: -0.03em;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }
    .brand-text strong {
      font-size: 1.05rem;
      color: #fbbf24;
      letter-spacing: 0.04em;
    }
    .brand-text span {
      font-size: 0.7rem;
      opacity: 0.8;
      letter-spacing: 0.12em;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      flex: 1;
    }
    nav a {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.7rem 0.85rem;
      border-radius: 10px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.15s;
    }
    nav a:hover {
      background: rgba(255,255,255,0.06);
      color: #e2e8f0;
    }
    nav a.active {
      background: linear-gradient(90deg, #2563eb, #3b82f6);
      color: #fff;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }
    .icon { width: 1.1rem; text-align: center; opacity: 0.9; }
    .sidebar-footer {
      padding: 1rem 0.75rem;
      font-size: 0.75rem;
      color: #64748b;
      line-height: 1.35;
    }
    .tagline {
      margin-top: 0.4rem;
      color: #fbbf24;
      font-weight: 500;
      font-size: 0.72rem;
    }
    .user-chip {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.7rem 0.75rem;
      border-radius: 12px;
      background: rgba(255,255,255,0.06);
      cursor: pointer;
      margin-top: 0.25rem;
    }
    .user-chip:hover { background: rgba(255,255,255,0.1); }
    .avatar, .avatar-sm {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      display: grid;
      place-items: center;
    }
    .avatar-sm { width: 34px; height: 34px; }
    .avatar, .avatar-sm { object-fit: cover; }
    .profile-link { text-decoration:none; border-radius:50%; cursor:pointer; }
    .logout-button {
      margin-left:auto;
      width:30px;
      height:30px;
      border:0;
      border-radius:8px;
      background:rgba(255,255,255,.06);
      color:#cbd5e1;
      cursor:pointer;
    }
    .logout-button:hover { background:rgba(239,68,68,.18); color:#fecaca; }
    .user-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }
    .user-meta strong { font-size: 0.82rem; color: #f1f5f9; }
    .user-meta span { font-size: 0.72rem; color: #94a3b8; }
    .main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }
    .topbar {
      position: relative;
      z-index: 80;
      flex: 0 0 64px;
      height: 64px;
      overflow: visible;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      gap: 1rem;
    }
    .search {
      flex: 1;
      max-width: 480px;
      position: relative;
      z-index: 1;
    }
    .search-results {
      position:absolute;
      top:48px;
      left:0;
      right:0;
      max-height:320px;
      overflow-y:auto;
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:12px;
      box-shadow:0 18px 45px rgba(15,23,42,.16);
      padding:.35rem;
      z-index:100;
    }
    .search-results button {
      width:100%;
      min-height:52px;
      border:0;
      border-radius:9px;
      background:transparent;
      color:var(--text);
      display:grid;
      grid-template-columns:auto 1fr auto;
      align-items:center;
      gap:.7rem;
      padding:.55rem .65rem;
      text-align:left;
      cursor:pointer;
    }
    .search-results button:hover { background:var(--surface-soft, #f8fafc); }
    .search-results button > span:nth-child(2) { display:flex; flex-direction:column; }
    .search-results strong { font-size:.82rem; }
    .search-results small { color:var(--muted); margin-top:.15rem; }
    .result-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:9px; background:rgba(99,102,241,.1); color:#6366f1; }
    .result-arrow { color:var(--muted); }
    .search-icon {
      position: absolute;
      left: 0.9rem;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
    }
    .search input {
      width: 100%;
      padding: 0.6rem 1rem 0.6rem 2.4rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 999px;
      background: #f8fafc;
      font-size: 0.9rem;
    }
    .search input:focus {
      outline: none;
      border-color: #93c5fd;
      background: #fff;
    }
    .top-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      position: relative;
      z-index: 2;
    }
    .icon-btn {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      position: relative;
      font-size: 1rem;
    }
    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: grid;
      place-items: center;
    }
    .notifications {
      position: absolute;
      right: 0;
      top: calc(100% + 12px);
      width: 320px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 18px 45px rgba(15,23,42,.18);
      z-index: 1000;
      overflow: hidden;
    }
    .notifications-head { display:flex; align-items:center; justify-content:space-between; padding:.85rem 1rem; border-bottom:1px solid var(--border); color:var(--text); }
    .notifications-head button { border:0; background:transparent; color:var(--muted); font-size:1.1rem; cursor:pointer; }
    .notice { display:flex; flex-direction:column; gap:.2rem; width:100%; padding:.75rem 1rem; border:0; border-bottom:1px solid var(--border); background:var(--surface); color:var(--text); text-align:left; cursor:pointer; }
    .notice:hover { background:var(--surface-soft,#f8fafc); }
    .notice:last-child { border-bottom:0; }
    .empty-notice { cursor:default; }
    .notice b { color:var(--text); font-size:.82rem; }
    .notice span { color:var(--muted); font-size:.75rem; }
    .content {
      flex: 1;
      overflow: auto;
      padding: 1.5rem;
      background: var(--content-bg);
    }
    .mobile-menu, .mobile-back { display: none; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar { position: fixed; inset: 0 auto 0 0; width: 240px; z-index: 50; transform: translateX(-100%); transition: transform .2s ease; }
      .sidebar.open { transform: translateX(0); box-shadow: 20px 0 50px rgba(15,23,42,.28); }
      .mobile-back { display: grid; width:38px; height:38px; place-items:center; border:1px solid var(--border); border-radius:10px; background:var(--surface); color:var(--text); }
      .topbar { height:58px; flex-basis:58px; padding:.5rem .75rem; }
      .search { max-width:none; }
      .top-actions .avatar-sm { display:none; }
      .notifications { width:min(320px, calc(100vw - 24px)); right:0; top:calc(100% + 10px); }
      .content { padding: 1rem; }
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
  readonly searchResults = signal<Array<{ title: string; type: string; route: string; icon: string }>>([]);
  isStudent = computed(() => this.auth.hasRole('student'));
  isLeader = computed(() => this.auth.hasRole('project_leader'));
  isAdviserOnly = computed(() => this.auth.hasRole('adviser'));
  isAdmin = computed(() => this.auth.hasRole('admin'));

  readonly noticeItems = computed(() => {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + 7);
    const due = this.data.deadlines()
      .filter(item => {
        const date = new Date(`${item.dueDate}T00:00:00`);
        return date <= cutoff;
      })
      .map(item => ({
        id: `deadline-${item.id}`,
        title: item.dueDate < today.toISOString().slice(0, 10) ? 'Overdue item' : 'Upcoming deadline',
        description: `${item.title} · ${item.dueDate}`,
        route: '/deadlines',
        date: item.dueDate
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
        date: item.createdAt
      }));
    return [...due, ...activity]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
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
      this.openSearchResult(this.searchResults()[0].route);
      return;
    }
    const lower = query.toLowerCase();
    if (lower.includes('task')) {
      this.router.navigate([this.isAdmin() ? '/admin' : this.isAdviserOnly() ? '/adviser' : '/tasks']);
    }
    else if (lower.includes('work') || lower.includes('member') || lower.includes('contribution')) {
      this.router.navigate([this.isLeader() ? '/workload' : this.isAdmin() ? '/admin' : '/contributions']);
    }
    else if (lower.includes('deadline') || lower.includes('due')) {
      this.router.navigate([this.isStudent() || this.isLeader() ? '/deadlines' : this.isAdviserOnly() ? '/adviser' : '/admin']);
    }
    else if (lower.includes('file') || lower.includes('document')) this.router.navigate([this.isAdmin() ? '/admin' : '/files']);
    else this.router.navigate([this.isAdmin() ? '/admin' : '/projects'], { queryParams: { q: query } });
  }

  updateSearchResults(): void {
    this.notificationsOpen.set(false);
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.searchResults.set([]);
      return;
    }

    const results: Array<{ title: string; type: string; route: string; icon: string }> = [];
    const projectRoute = this.isAdmin() ? '/admin' : '/projects';
    const taskRoute = this.isAdmin() ? '/admin' : this.isAdviserOnly() ? '/adviser' : '/tasks';
    this.data.projects().forEach(project => {
      if (project.title.toLowerCase().includes(query) || project.description.toLowerCase().includes(query)) {
        results.push({ title: project.title, type: 'Project', route: projectRoute, icon: '▣' });
      }
    });
    this.data.tasks().forEach(task => {
      if (task.title.toLowerCase().includes(query)) {
        results.push({ title: task.title, type: 'Task', route: taskRoute, icon: '☑' });
      }
    });
    this.data.team().forEach(member => {
      if (member.name.toLowerCase().includes(query)) {
        const route = this.isAdmin() ? '/admin' : this.isLeader() ? '/workload' : '/contributions';
        results.push({ title: member.name, type: 'Team member', route, icon: '●' });
      }
    });
    this.searchResults.set(results.slice(0, 8));
  }

  openSearchResult(route: string): void {
    this.searchResults.set([]);
    this.notificationsOpen.set(false);
    this.searchQuery = '';
    this.router.navigate([route]);
  }

  toggleNotifications(): void {
    this.searchResults.set([]);
    this.notificationsOpen.update(open => !open);
  }
}
