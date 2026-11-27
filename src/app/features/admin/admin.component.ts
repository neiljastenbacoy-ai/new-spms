import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService, MIN_ADMIN_PROMOTION_REASON } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { SystemSettings, User, UserRole } from '../../core/models/models';

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
    @if (memberFilter()) {
      <div class="context-filter">
        <span>Showing account {{ memberName(memberFilter()) }}</span>
        <button type="button" (click)="clearMemberFilter()">Show all accounts</button>
      </div>
    }

    @if (section() === 'accounts') {
      <section class="section-card">
        <div class="section-head">
          <div>
            <h2>User accounts</h2>
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
                    <select class="role-select" [ngModel]="roleValue(user)"
                      [disabled]="savingUserId() === user.id || user.id === auth.user()?.id"
                      (ngModelChange)="requestRole(user, $event)">
                      <option value="student">Student</option>
                      <option value="project_leader">Project Leader</option>
                      <option value="adviser">Instructor / Adviser</option>
                      @if (user.role === 'admin') {
                        <option value="admin" disabled>Administrator</option>
                      }
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
          </div>
          <span class="retention">Latest {{ data.auditLogs().length }} records</span>
        </div>
        <div class="audit-list">
          @for (record of data.auditLogs(); track record.id) {
            <article class="audit-row">
              <span class="audit-icon">↗</span>
              <div class="audit-copy">
                <strong>{{ record.details }}</strong>
                <span>{{ actionLabel(record.action) }}{{ record.targetName ? ' · ' + record.targetName : '' }}</span>
              </div>
              <div class="audit-meta"><strong>{{ record.actorName }}</strong><time>{{ formatDate(record.createdAt) }}</time></div>
            </article>
          } @empty {
            <div class="empty-state"><strong>No audit events</strong></div>
          }
        </div>
      </section>
      <section class="section-card project-audit">
        <div class="section-head">
          <div><h2>Recent project activity</h2></div>
        </div>
        <div class="audit-list">
          @for (activity of recentActivities(); track activity.id) {
            <article class="audit-row">
              <span class="audit-icon">•</span>
              <div class="audit-copy"><strong>{{ activity.message }}</strong><span>{{ activityLabel(activity.type) }}</span></div>
              <div class="audit-meta"><time>{{ formatDate(activity.createdAt) }}</time></div>
            </article>
          } @empty {
            <div class="empty-state"><strong>No project activity yet</strong><span>Task status and file actions will be listed here.</span></div>
          }
        </div>
      </section>
    }

    @if (pendingRole(); as pending) {
      <div class="modal-backdrop" (click)="cancelAdminGrant()">
        <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="grant-title">
          <h2 id="grant-title">Grant administrator access</h2>
          <p class="modal-sub">{{ pending.user.name }} · {{ pending.user.email }}</p>
          <p class="modal-warn">Administrators can change every role, disable any account, and read the full audit log. This is not reversible by anyone but another administrator.</p>
          <label>Justification
            <textarea [(ngModel)]="roleReason" rows="3" placeholder="Why does this person need administrator access?"></textarea>
          </label>
          <label>Type <code>{{ confirmWord }}</code> to confirm
            <input [(ngModel)]="confirmPhrase" autocomplete="off" spellcheck="false" />
          </label>
          @if (confirmError()) { <div class="notice error" role="alert">{{ confirmError() }}</div> }
          <div class="modal-actions">
            <button type="button" class="cancel" (click)="cancelAdminGrant()">Cancel</button>
            <button type="button" class="danger"
              [disabled]="savingUserId() === pending.user.id"
              (click)="confirmAdminGrant()">Grant access</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display:block; --admin-surface:var(--surface,#fff); --admin-text:var(--text,var(--text)); --admin-muted:var(--muted,var(--muted)); --admin-border:var(--border,var(--border)); }
    .page-head,.section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
    .page-head { margin-bottom:1.35rem; }
    .eyebrow { margin:0 0 .4rem; color:var(--accent); font-size:.68rem; font-weight:800; letter-spacing:.14em; }
    h1 { margin:0; color:var(--admin-text); font-size:clamp(1.6rem,2.4vw,2rem); letter-spacing:-.04em; }
    .page-head > div > p:last-child,.section-head p { margin:.35rem 0 0; color:var(--admin-muted); font-size:.88rem; }
    .admin-chip,.retention { border:1px solid var(--admin-border); border-radius:999px; padding:.45rem .7rem; color:var(--admin-muted); font-size:.76rem; font-weight:700; white-space:nowrap; }
    .tabs { display:flex; gap:.3rem; padding:.3rem; margin-bottom:1rem; overflow-x:auto; background:var(--admin-surface); border:1px solid var(--admin-border); border-radius:12px; }
    .tabs button { border:0; border-radius:9px; background:transparent; color:var(--admin-muted); padding:.62rem .85rem; font-weight:700; white-space:nowrap; cursor:pointer; }
    .tabs button.active { background:var(--hover,var(--surface-2)); color:var(--admin-text); }
    .tabs span { margin-left:.25rem; color:var(--accent); }
    .notice { margin-bottom:.9rem; padding:.75rem .9rem; border:1px solid #bbf7d0; border-radius:10px; background:var(--surface-2); color:var(--moss); font-size:.82rem; }
    .notice.error { border-color:var(--danger-soft); background:var(--danger-soft); color:var(--danger); }
    .context-filter { display:flex; align-items:center; gap:.65rem; margin:-.3rem 0 1rem; padding:.65rem .8rem; border:1px solid var(--admin-border); border-radius:8px; background:var(--surface-2); color:var(--admin-text); font-size:.78rem; }
    .context-filter button { margin-left:auto; border:0; padding:0; background:transparent; color:var(--accent); font:inherit; font-weight:700; cursor:pointer; }
    .section-card { overflow:hidden; border:1px solid var(--admin-border); border-radius:16px; background:var(--admin-surface); box-shadow:var(--shadow,0 8px 24px rgba(15,23,42,.04)); }
    .section-head { align-items:center; padding:1.15rem 1.25rem; border-bottom:1px solid var(--admin-border); }
    h2 { margin:0; color:var(--admin-text); font-size:1rem; letter-spacing:-.02em; }
    .filters { display:flex; gap:.55rem; }
    .filters input,.filters select,.role-select,.settings-form input:not([type=checkbox]),.settings-form select { min-height:40px; border:1px solid var(--admin-border); border-radius:9px; background:var(--input,#fff); color:var(--admin-text); padding:.5rem .7rem; font:inherit; font-size:.8rem; }
    .filters input { width:min(250px,35vw); }
    .table-wrap { overflow:auto; }
    table { width:100%; border-collapse:collapse; text-align:left; }
    th { padding:.75rem 1rem; background:var(--surface-soft,var(--surface-2)); color:var(--admin-muted); font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; }
    td { padding:.78rem 1rem; border-top:1px solid var(--admin-border); color:var(--admin-text); font-size:.82rem; white-space:nowrap; }
    .user-cell { display:flex; align-items:center; gap:.65rem; }
    .user-cell > span:last-child { display:flex; flex-direction:column; gap:.18rem; }
    .user-cell strong { color:var(--admin-text); }
    .user-cell small { color:var(--admin-muted); font-size:.68rem; }
    .avatar { display:grid; width:34px; height:34px; place-items:center; border-radius:50%; object-fit:cover; background:linear-gradient(135deg,var(--accent),#8b5cf6); color:#fff; font-size:.72rem; font-weight:800; }
    .role-select { min-width:154px; }
    .state { display:inline-flex; align-items:center; gap:.35rem; color:var(--moss); font-size:.74rem; font-weight:700; }
    .state::before { width:7px; height:7px; border-radius:50%; background:currentColor; content:''; }
    .state.disabled { color:var(--danger); }
    .access-button { border:1px solid var(--admin-border); border-radius:8px; background:transparent; color:var(--admin-text); padding:.4rem .65rem; font:inherit; font-size:.75rem; font-weight:700; cursor:pointer; }
    .access-button:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .empty { padding:2rem; text-align:center; color:var(--admin-muted); }
    .settings-form { display:grid; max-width:700px; gap:1.1rem; padding:1.25rem; }
    .settings-form > label { display:grid; gap:.4rem; color:var(--admin-text); font-size:.8rem; font-weight:700; }
    .toggle-row { display:flex!important; align-items:center; justify-content:space-between; padding:.9rem 0; border-top:1px solid var(--admin-border); border-bottom:1px solid var(--admin-border); }
    .toggle-row span { display:grid; gap:.2rem; }
    .toggle-row small { color:var(--admin-muted); font-size:.75rem; font-weight:400; }
    .toggle-row input { width:18px; height:18px; accent-color:var(--accent); }
    .settings-footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
    .settings-footer span { color:var(--admin-muted); font-size:.74rem; }
    .settings-footer button { border:0; border-radius:9px; background:linear-gradient(135deg,var(--accent),var(--accent)); color:#fff; padding:.65rem .9rem; font:inherit; font-size:.8rem; font-weight:800; cursor:pointer; }
    .audit-list { padding:0 1.2rem; }
    .project-audit { margin-top:1rem; }
    .audit-row { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:.8rem; padding:.9rem 0; border-bottom:1px solid var(--admin-border); }
    .audit-row:last-child { border-bottom:0; }
    .audit-icon { display:grid; width:34px; height:34px; place-items:center; border-radius:10px; background:var(--surface-soft,var(--surface-2)); color:var(--accent); font-weight:800; }
    .audit-copy,.audit-meta { display:flex; flex-direction:column; gap:.23rem; }
    .audit-copy strong,.audit-meta strong { color:var(--admin-text); font-size:.8rem; }
    .audit-copy span,.audit-meta time { color:var(--admin-muted); font-size:.72rem; }
    .audit-meta { align-items:flex-end; }
    .empty-state { display:grid; gap:.35rem; padding:2.5rem 1rem; text-align:center; color:var(--admin-muted); font-size:.82rem; }
    .empty-state strong { color:var(--admin-text); }
    .modal-backdrop { position:fixed; inset:0; z-index:90; display:grid; place-items:center; padding:1rem; background:rgba(15,23,42,.5); }
    .modal { width:min(480px,94vw); display:flex; flex-direction:column; gap:.85rem; padding:1.4rem; border:1px solid var(--admin-border); border-radius:12px; background:var(--admin-surface); box-shadow:0 24px 60px rgba(15,23,42,.28); }
    .modal h2 { font-size:1.05rem; }
    .modal-sub { margin:-.5rem 0 0; color:var(--admin-muted); font-size:.78rem; }
    .modal-warn { margin:0; padding:.6rem .7rem; border-left:3px solid var(--ochre); border-radius:4px; background:var(--accent-soft); color:var(--ochre); font-size:.76rem; line-height:1.45; }
    .modal label { display:grid; gap:.4rem; color:var(--admin-text); font-size:.78rem; font-weight:700; }
    .modal textarea,.modal input { border:1px solid var(--admin-border); border-radius:9px; background:var(--input,#fff); color:var(--admin-text); padding:.55rem .65rem; font:inherit; font-size:.8rem; resize:vertical; }
    .modal code { padding:.1rem .3rem; border-radius:3px; background:var(--surface-soft,var(--surface-2)); font-size:.72rem; letter-spacing:.06em; }
    .modal-actions { display:flex; justify-content:flex-end; gap:.5rem; margin-top:.25rem; }
    .modal-actions button { border-radius:8px; padding:.55rem .85rem; font:inherit; font-size:.78rem; font-weight:700; cursor:pointer; }
    .modal-actions .cancel { border:1px solid var(--admin-border); background:transparent; color:var(--admin-text); }
    .modal-actions .danger { border:0; background:#a94c3e; color:#fff; }
    .modal-actions .danger:disabled { opacity:.55; cursor:not-allowed; }
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly section = signal<AdminSection>('accounts');
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly savingUserId = signal<string | null>(null);
  readonly savingSettings = signal(false);
  readonly pendingRole = signal<{ user: User; role: UserRole } | null>(null);
  readonly confirmError = signal('');
  readonly roleReset = signal(0);
  readonly memberFilter = signal('');
  readonly confirmWord = 'GRANT ADMIN';
  readonly team = this.data.team;
  search = '';
  roleFilter = 'all';
  roleReason = '';
  confirmPhrase = '';
  settingsForm: SystemSettings = { academicYear: '', semester: '', registrationOpen: true };

  constructor() {
    effect(() => Object.assign(this.settingsForm, this.data.systemSettings()));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.memberFilter.set(params.get('memberId') ?? '');
      this.search = params.get('q') ?? '';
    });
  }

  filteredTeam() {
    const query = this.search.trim().toLowerCase();
    return this.team().filter(user =>
      (!this.memberFilter() || user.id === this.memberFilter())
      && (this.roleFilter === 'all' || user.role === this.roleFilter)
      && (!query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query))
    );
  }

  memberName(userId: string): string {
    return this.team().find(user => user.id === userId)?.name ?? 'selected user';
  }

  clearMemberFilter(): void {
    this.memberFilter.set('');
    this.search = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { memberId: null, q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  recentActivities() {
    return this.data.activities().slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 25);
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  }

  async updateRole(userId: string, role: UserRole, reason?: string): Promise<boolean> {
    this.savingUserId.set(userId);
    this.clearMessage();
    try {
      await this.data.updateTeamMemberRole(userId, role, reason ? { reason } : {});
      const name = this.team().find(user => user.id === userId)?.name ?? 'The user';
      this.message.set(
        role === 'admin'
          ? `${name} is now an administrator. The justification is recorded in the audit log.`
          : 'User role updated and recorded in the audit log.'
      );
      this.roleReset.update(value => value + 1);
      return true;
    } catch (error) {
      console.error('User role update failed.', error);
      this.showError(this.errorMessage(error));
      return false;
    } finally {
      this.savingUserId.set(null);
    }
  }

  /** Keeps the select bound to the stored role until a change is confirmed. */
  roleValue(user: User): UserRole {
    this.roleReset();
    return user.role;
  }

  requestRole(user: User, role: UserRole): void {
    if (role === user.role) return;
    this.clearMessage();
    if (role === 'admin') {
      this.roleReset.update(value => value + 1);
      this.showError('Administrator access cannot be granted from role promotion.');
      return;
    }
    void this.updateRole(user.id, role);
  }

  cancelAdminGrant(): void {
    this.pendingRole.set(null);
    this.roleReason = '';
    this.confirmPhrase = '';
    this.confirmError.set('');
    this.roleReset.update(value => value + 1);
  }

  async confirmAdminGrant(): Promise<void> {
    const pending = this.pendingRole();
    if (!pending) return;

    const reason = this.roleReason.trim();
    if (reason.length < MIN_ADMIN_PROMOTION_REASON) {
      this.confirmError.set(
        `Write a justification of at least ${MIN_ADMIN_PROMOTION_REASON} characters.`
      );
      return;
    }
    if (this.confirmPhrase.trim().toUpperCase() !== this.confirmWord) {
      this.confirmError.set(`Type ${this.confirmWord} exactly to confirm.`);
      return;
    }

    this.confirmError.set('');
    const saved = await this.updateRole(pending.user.id, pending.role, reason);
    if (saved) {
      this.pendingRole.set(null);
      this.roleReason = '';
      this.confirmPhrase = '';
    } else {
      this.roleReset.update(value => value + 1);
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

  /** `project.feedback_added` → `Project feedback added`. */
  actionLabel(action: string): string {
    const words = action.replace(/[._]/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  activityLabel(type: string): string {
    const words = type.replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
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
    if (message.includes('administrator access')) return message;
    if (message.includes('written justification')) return message;
    if (message.includes('Enable the account')) return message;
    return 'The change was not saved. Check Firebase permissions and connectivity.';
  }
}
