import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { SystemSettings, UserRole } from '../../core/models/models';

type AdminSection = 'accounts' | 'settings' | 'audit';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">SYSTEM CONTROL</p>
        <h1>Administration</h1>
        <p>Manage accounts, access, workspace settings, and audit history.</p>
      </div>
      <span class="admin-chip">Administrator</span>
    </header>

    <nav class="tabs" aria-label="Administration sections">
      <button type="button" [class.active]="section() === 'accounts'" (click)="section.set('accounts')">Accounts <span>{{ team().length }}</span></button>
      <button type="button" [class.active]="section() === 'settings'" (click)="section.set('settings')">System settings</button>
      <button type="button" [class.active]="section() === 'audit'" (click)="section.set('audit')">Audit log <span>{{ data.auditLogs().length }}</span></button>
    </nav>

    @if (message()) {
      <div class="notice" [class.error]="messageIsError()" role="status">{{ message() }}</div>
    }

    @if (section() === 'accounts') {
      <section class="section-card">
        <div class="section-head">
          <div>
            <h2>User accounts</h2>
            <p>Set each user’s role and control access to SPMS.</p>
          </div>
          <div class="filters">
            <input type="search" [(ngModel)]="search" placeholder="Search name or email" aria-label="Search users" />
            <select [(ngModel)]="roleFilter" aria-label="Filter users by role">
              <option value="all">All roles</option>
              <option value="student">Students</option>
              <option value="project_leader">Project leaders</option>
              <option value="adviser">Advisers</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Access</th><th>Control</th></tr>
            </thead>
            <tbody>
              @for (user of filteredTeam(); track user.id) {
                <tr>
                  <td>
                    <div class="user-cell">
                      @if (user.photoUrl) { <img class="avatar" [src]="user.photoUrl" alt="" /> }
                      @else { <span class="avatar initials">{{ initials(user.name) }}</span> }
                      <span><strong>{{ user.name }}</strong><small>{{ user.id === auth.user()?.id ? 'You' : user.studentId || 'SPMS account' }}</small></span>
                    </div>
                  </td>
                  <td class="muted">{{ user.email }}</td>
                  <td>
                    <select class="role-select" [ngModel]="user.role"
                      [disabled]="savingUserId() === user.id || user.id === auth.user()?.id"
                      (ngModelChange)="updateRole(user.id, $event)">
                      <option value="student">Student</option>
                      <option value="project_leader">Project Leader</option>
                      <option value="adviser">Instructor / Adviser</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </td>
                  <td><span class="state" [class.disabled]="user.isActive === false">{{ user.isActive === false ? 'Disabled' : 'Active' }}</span></td>
                  <td>
                    <button class="access-button" type="button"
                      [disabled]="savingUserId() === user.id || user.id === auth.user()?.id"
                      (click)="setActive(user.id, user.isActive === false)">
                      {{ user.isActive === false ? 'Enable' : 'Disable' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td class="empty" colspan="5">No users match this search.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    @if (section() === 'settings') {
      <section class="section-card settings-card">
        <div class="section-head">
          <div>
            <h2>System settings</h2>
            <p>Set the academic period and control new student registration.</p>
          </div>
        </div>
        <form (ngSubmit)="saveSettings()" class="settings-form">
          <label>
            Academic year
            <input name="academicYear" [(ngModel)]="settingsForm.academicYear" placeholder="2026–2027" required />
          </label>
          <label>
            Current semester
            <select name="semester" [(ngModel)]="settingsForm.semester" required>
              <option value="">Select a semester</option>
              <option value="First Semester">First Semester</option>
              <option value="Second Semester">Second Semester</option>
              <option value="Summer">Summer</option>
            </select>
          </label>
          <label class="toggle-row">
            <span><strong>Student registration</strong><small>Allow new student accounts to register.</small></span>
            <input type="checkbox" name="registrationOpen" [(ngModel)]="settingsForm.registrationOpen" />
          </label>
          <div class="settings-footer">
            <span>Changes are recorded in the audit log.</span>
            <button type="submit" [disabled]="savingSettings()">Save settings</button>
          </div>
        </form>
      </section>
    }

    @if (section() === 'audit') {
      <section class="section-card">
        <div class="section-head">
          <div>
            <h2>Audit history</h2>
            <p>Recent account and system configuration changes.</p>
          </div>
          <span class="retention">Latest {{ data.auditLogs().length }} records</span>
        </div>
        <div class="audit-list">
          @for (record of data.auditLogs(); track record.id) {
            <article class="audit-row">
              <span class="audit-icon">↗</span>
              <div class="audit-copy">
                <strong>{{ record.details }}</strong>
                <span>{{ record.action.replace('.', ' · ') }}{{ record.targetName ? ' · ' + record.targetName : '' }}</span>
              </div>
              <div class="audit-meta"><strong>{{ record.actorName }}</strong><time>{{ formatDate(record.createdAt) }}</time></div>
            </article>
          } @empty {
            <div class="empty-state"><strong>No audit events yet</strong><span>Role and system setting changes will appear here.</span></div>
          }
        </div>
      </section>
      <section class="section-card project-audit">
        <div class="section-head">
          <div><h2>Recent project activity</h2><p>Task progress and file actions from across the workspace.</p></div>
        </div>
        <div class="audit-list">
          @for (activity of recentActivities(); track activity.id) {
            <article class="audit-row">
              <span class="audit-icon">•</span>
              <div class="audit-copy"><strong>{{ activity.message }}</strong><span>{{ activity.type.replace('_', ' ') }}</span></div>
              <div class="audit-meta"><time>{{ formatDate(activity.createdAt) }}</time></div>
            </article>
          } @empty {
            <div class="empty-state"><strong>No project activity yet</strong><span>Task status and file actions will be listed here.</span></div>
          }
        </div>
      </section>
    }
  `,
  styles: [`
    :host { display:block; --admin-surface:var(--surface,#fff); --admin-text:var(--text,#0f172a); --admin-muted:var(--muted,#64748b); --admin-border:var(--border,#e2e8f0); }
    .page-head,.section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
    .page-head { margin-bottom:1.35rem; }
    .eyebrow { margin:0 0 .4rem; color:#6268e8; font-size:.68rem; font-weight:800; letter-spacing:.14em; }
    h1 { margin:0; color:var(--admin-text); font-size:clamp(1.6rem,2.4vw,2rem); letter-spacing:-.04em; }
    .page-head > div > p:last-child,.section-head p { margin:.35rem 0 0; color:var(--admin-muted); font-size:.88rem; }
    .admin-chip,.retention { border:1px solid var(--admin-border); border-radius:999px; padding:.45rem .7rem; color:var(--admin-muted); font-size:.76rem; font-weight:700; white-space:nowrap; }
    .tabs { display:flex; gap:.3rem; padding:.3rem; margin-bottom:1rem; overflow-x:auto; background:var(--admin-surface); border:1px solid var(--admin-border); border-radius:12px; }
    .tabs button { border:0; border-radius:9px; background:transparent; color:var(--admin-muted); padding:.62rem .85rem; font-weight:700; white-space:nowrap; cursor:pointer; }
    .tabs button.active { background:var(--hover,#eef2ff); color:var(--admin-text); }
    .tabs span { margin-left:.25rem; color:#6268e8; }
    .notice { margin-bottom:.9rem; padding:.75rem .9rem; border:1px solid #bbf7d0; border-radius:10px; background:#f0fdf4; color:#166534; font-size:.82rem; }
    .notice.error { border-color:#fecaca; background:#fef2f2; color:#b91c1c; }
    .section-card { overflow:hidden; border:1px solid var(--admin-border); border-radius:16px; background:var(--admin-surface); box-shadow:var(--shadow,0 8px 24px rgba(15,23,42,.04)); }
    .section-head { align-items:center; padding:1.15rem 1.25rem; border-bottom:1px solid var(--admin-border); }
    h2 { margin:0; color:var(--admin-text); font-size:1rem; letter-spacing:-.02em; }
    .filters { display:flex; gap:.55rem; }
    .filters input,.filters select,.role-select,.settings-form input:not([type=checkbox]),.settings-form select { min-height:40px; border:1px solid var(--admin-border); border-radius:9px; background:var(--input,#fff); color:var(--admin-text); padding:.5rem .7rem; font:inherit; font-size:.8rem; }
    .filters input { width:min(250px,35vw); }
    .table-wrap { overflow:auto; }
    table { width:100%; border-collapse:collapse; text-align:left; }
    th { padding:.75rem 1rem; background:var(--surface-soft,#f8fafc); color:var(--admin-muted); font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; }
    td { padding:.78rem 1rem; border-top:1px solid var(--admin-border); color:var(--admin-text); font-size:.82rem; white-space:nowrap; }
    .user-cell { display:flex; align-items:center; gap:.65rem; }
    .user-cell > span:last-child { display:flex; flex-direction:column; gap:.18rem; }
    .user-cell strong { color:var(--admin-text); }
    .user-cell small { color:var(--admin-muted); font-size:.68rem; }
    .avatar { display:grid; width:34px; height:34px; place-items:center; border-radius:50%; object-fit:cover; background:linear-gradient(135deg,#4f46e5,#8b5cf6); color:#fff; font-size:.72rem; font-weight:800; }
    .role-select { min-width:154px; }
    .state { display:inline-flex; align-items:center; gap:.35rem; color:#15803d; font-size:.74rem; font-weight:700; }
    .state::before { width:7px; height:7px; border-radius:50%; background:currentColor; content:''; }
    .state.disabled { color:#b91c1c; }
    .access-button { border:1px solid var(--admin-border); border-radius:8px; background:transparent; color:var(--admin-text); padding:.4rem .65rem; font:inherit; font-size:.75rem; font-weight:700; cursor:pointer; }
    .access-button:hover:not(:disabled) { border-color:#a5b4fc; color:#4f46e5; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .empty { padding:2rem; text-align:center; color:var(--admin-muted); }
    .settings-form { display:grid; max-width:700px; gap:1.1rem; padding:1.25rem; }
    .settings-form > label { display:grid; gap:.4rem; color:var(--admin-text); font-size:.8rem; font-weight:700; }
    .toggle-row { display:flex!important; align-items:center; justify-content:space-between; padding:.9rem 0; border-top:1px solid var(--admin-border); border-bottom:1px solid var(--admin-border); }
    .toggle-row span { display:grid; gap:.2rem; }
    .toggle-row small { color:var(--admin-muted); font-size:.75rem; font-weight:400; }
    .toggle-row input { width:18px; height:18px; accent-color:#5b67f1; }
    .settings-footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
    .settings-footer span { color:var(--admin-muted); font-size:.74rem; }
    .settings-footer button { border:0; border-radius:9px; background:linear-gradient(135deg,#5661d8,#7c83ed); color:#fff; padding:.65rem .9rem; font:inherit; font-size:.8rem; font-weight:800; cursor:pointer; }
    .audit-list { padding:0 1.2rem; }
    .project-audit { margin-top:1rem; }
    .audit-row { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:.8rem; padding:.9rem 0; border-bottom:1px solid var(--admin-border); }
    .audit-row:last-child { border-bottom:0; }
    .audit-icon { display:grid; width:34px; height:34px; place-items:center; border-radius:10px; background:var(--surface-soft,#f8fafc); color:#5b67f1; font-weight:800; }
    .audit-copy,.audit-meta { display:flex; flex-direction:column; gap:.23rem; }
    .audit-copy strong,.audit-meta strong { color:var(--admin-text); font-size:.8rem; }
    .audit-copy span,.audit-meta time { color:var(--admin-muted); font-size:.72rem; }
    .audit-meta { align-items:flex-end; }
    .empty-state { display:grid; gap:.35rem; padding:2.5rem 1rem; text-align:center; color:var(--admin-muted); font-size:.82rem; }
    .empty-state strong { color:var(--admin-text); }
    @media(max-width:720px) {
      .section-head { align-items:stretch; flex-direction:column; }
      .filters { flex-direction:column; }
      .filters input { width:100%; }
      .audit-row { grid-template-columns:auto 1fr; }
      .audit-meta { grid-column:2; align-items:flex-start; }
      .settings-footer { align-items:flex-start; flex-direction:column; }
    }
  `]
})
export class AdminComponent {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  readonly section = signal<AdminSection>('accounts');
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly savingUserId = signal<string | null>(null);
  readonly savingSettings = signal(false);
  readonly team = this.data.team;
  search = '';
  roleFilter = 'all';
  settingsForm: SystemSettings = { academicYear: '', semester: '', registrationOpen: true };

  constructor() {
    effect(() => Object.assign(this.settingsForm, this.data.systemSettings()));
  }

  filteredTeam() {
    const query = this.search.trim().toLowerCase();
    return this.team().filter(user =>
      (this.roleFilter === 'all' || user.role === this.roleFilter)
      && (!query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query))
    );
  }

  recentActivities() {
    return this.data.activities().slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 25);
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  }

  async updateRole(userId: string, role: UserRole): Promise<void> {
    this.savingUserId.set(userId);
    this.clearMessage();
    try {
      await this.data.updateTeamMemberRole(userId, role);
      this.message.set('User role updated and recorded in the audit log.');
    } catch (error) {
      console.error('User role update failed.', error);
      this.showError(this.errorMessage(error));
    } finally {
      this.savingUserId.set(null);
    }
  }

  async setActive(userId: string, isActive: boolean): Promise<void> {
    this.savingUserId.set(userId);
    this.clearMessage();
    try {
      await this.data.setUserActive(userId, isActive);
      this.message.set(`Account ${isActive ? 'enabled' : 'disabled'} and recorded in the audit log.`);
    } catch (error) {
      console.error('User access update failed.', error);
      this.showError(this.errorMessage(error));
    } finally {
      this.savingUserId.set(null);
    }
  }

  async saveSettings(): Promise<void> {
    this.clearMessage();
    const changes: SystemSettings = {
      academicYear: this.settingsForm.academicYear.trim(),
      semester: this.settingsForm.semester,
      registrationOpen: this.settingsForm.registrationOpen
    };
    if (!changes.academicYear || !changes.semester) {
      this.showError('Enter an academic year and select a semester.');
      return;
    }
    this.savingSettings.set(true);
    try {
      await this.data.updateSystemSettings(changes);
      this.message.set('System settings saved and recorded in the audit log.');
    } catch (error) {
      console.error('System settings could not be saved.', error);
      this.showError(this.errorMessage(error));
    } finally {
      this.savingSettings.set(false);
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  private clearMessage(): void {
    this.message.set('');
    this.messageIsError.set(false);
  }

  private showError(message: string): void {
    this.message.set(message);
    this.messageIsError.set(true);
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('at least one active administrator')) return message;
    if (message.includes('your own account')) return message;
    return 'The change was not saved. Check Firebase permissions and connectivity.';
  }
}
