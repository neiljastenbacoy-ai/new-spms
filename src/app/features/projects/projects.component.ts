import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { Project, ProjectStatus } from '../../core/models/models';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ pageTitle() }}</h1>
        <p>{{ pageDescription() }}</p>
      </div>
      @if (canCreate()) {
        <button class="btn-primary" (click)="openCreate()">+ New Project</button>
      }
    </div>

    @if (error()) { <div class="operation-error">{{ error() }}</div> }

    @if (showForm()) {
      <div class="modal-backdrop" (click)="showForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editingId() ? 'Edit Project' : 'Create Project' }}</h2>
          @if (error()) { <div class="operation-error">{{ error() }}</div> }
          <label>Title <input [(ngModel)]="form.title" placeholder="Project title" /></label>
          <label>Description <textarea [(ngModel)]="form.description" rows="2"></textarea></label>
          <div class="project-options">
            <label>Deadline <input type="date" [(ngModel)]="form.deadline" /></label>
            <label>Adviser
              <select [(ngModel)]="form.adviserId">
                <option value="">No adviser</option>
                @for (adviser of advisers(); track adviser.id) {
                  <option [value]="adviser.id">{{ adviser.name }}</option>
                }
              </select>
            </label>
          </div>
          <fieldset class="member-picker">
            <legend>Project members</legend>
            @for (member of eligibleMembers(); track member.id) {
              <label>
                <input
                  type="checkbox"
                  [checked]="form.memberIds.includes(member.id)"
                  [disabled]="member.id === auth.user()?.id"
                  (change)="toggleMember(member.id, $event)"
                />
                <span>{{ member.name }} <small>{{ member.role.replace('_', ' ') }}</small></span>
              </label>
            }
          </fieldset>
          @if (editingId()) {
            <div class="project-options">
              <label>Status
                <select [(ngModel)]="form.status">
                  <option value="ongoing">On Going</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label>Progress <input type="range" min="0" max="100" [(ngModel)]="form.progress" /></label>
            </div>
          }
          <div class="modal-actions">
            <button class="btn-ghost" (click)="showForm.set(false)">Cancel</button>
            <button class="btn-primary" (click)="editingId() ? saveEdit() : create()">{{ editingId() ? 'Save Changes' : 'Create' }}</button>
          </div>
        </div>
      </div>
    }

    <div class="project-grid">
      @for (p of visibleProjects(); track p.id) {
        <article class="project-card">
          <div class="card-top" [style.border-top-color]="p.color">
            <span class="badge" [class]="p.status">{{ statusLabel(p.status) }}</span>
            <h3>{{ p.title }}</h3>
            <p>{{ p.description }}</p>
          </div>
          <div class="card-meta">
            <div class="progress-row">
              <div class="track"><div class="fill" [style.width.%]="p.progress" [style.background]="p.color"></div></div>
              <span>{{ p.progress }}%</span>
            </div>
            <div class="meta-row">
              <span>👥 {{ p.memberIds.length }} members</span>
              @if (p.deadline) {
                <span>📅 {{ p.deadline }}</span>
              }
            </div>
            @if (p.feedback?.length) {
              <div class="latest-feedback">
                <strong>Latest adviser feedback</strong>
                <p>{{ latestFeedback(p) }}</p>
              </div>
            }
            @if (canManage(p)) {
              <div class="card-actions">
                <button type="button" (click)="openEdit(p)">Edit</button>
                <button type="button" class="danger" (click)="deleteProject(p.id)">Delete</button>
              </div>
            }
          </div>
        </article>
      } @empty {
        <div class="empty-projects">
          <span class="empty-mark">▣</span>
          <h2>{{ auth.hasRole('student') ? 'No project assigned yet' : auth.hasRole('adviser') ? 'No projects assigned to you' : 'Start a project workspace' }}</h2>
          <p>{{ auth.hasRole('student') ? 'Your project leader can add you to a project. Assigned work will appear here.' : auth.hasRole('adviser') ? 'Projects assigned to you by a project leader will be listed here.' : 'Create a project, add your team, and set the first milestone.' }}</p>
          @if (canCreate()) { <button class="btn-primary" type="button" (click)="openCreate()">Create a project</button> }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .page-head h1 { margin: 0; font-size: 1.5rem; color: #0f172a; }
    .page-head p { margin: 0.25rem 0 0; color: #64748b; font-size: 0.9rem; }
    .btn-primary {
      padding: 0.65rem 1.2rem;
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-ghost {
      padding: 0.65rem 1.2rem;
      background: #f1f5f9;
      border: none;
      border-radius: 10px;
      cursor: pointer;
    }
    .project-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.1rem;
    }
    .project-card {
      background: #fff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      transition: box-shadow 0.15s;
    }
    .project-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
    .card-top {
      padding: 1.25rem;
      border-top: 4px solid #3b82f6;
    }
    .badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    .badge.ongoing { background: #dcfce7; color: #166534; }
    .badge.on_hold { background: #ffedd5; color: #9a3412; }
    .badge.completed { background: #dbeafe; color: #1e40af; }
    .badge.overdue { background: #fee2e2; color: #991b1b; }
    .card-top h3 { margin: 0 0 0.4rem; font-size: 1.05rem; color: #0f172a; }
    .card-top p { margin: 0; font-size: 0.85rem; color: #64748b; line-height: 1.4; }
    .card-meta { padding: 0 1.25rem 1.25rem; }
    .progress-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      font-size: 0.8rem;
      color: #64748b;
    }
    .track {
      flex: 1;
      height: 8px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .fill { height: 100%; border-radius: 999px; }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #64748b;
    }
    .latest-feedback { margin-top:.75rem; padding:.7rem; border-left:3px solid #818cf8; border-radius:0 9px 9px 0; background:var(--surface-soft,#f8fafc); }
    .latest-feedback strong { color:var(--text,#0f172a); font-size:.72rem; }
    .latest-feedback p { margin:.3rem 0 0; color:var(--muted,#64748b); font-size:.76rem; line-height:1.45; }
    .empty-projects { display:grid; justify-items:center; grid-column:1/-1; gap:.5rem; padding:3rem 1.25rem; border:1px dashed var(--border,#e2e8f0); border-radius:16px; background:var(--surface,#fff); text-align:center; }
    .empty-mark { display:grid; width:46px; height:46px; place-items:center; border-radius:14px; background:#eef2ff; color:#4f46e5; }
    .empty-projects h2 { margin:.3rem 0 0; color:var(--text,#0f172a); font-size:1rem; }
    .empty-projects p { max-width:440px; margin:0; color:var(--muted,#64748b); font-size:.82rem; line-height:1.5; }
    .card-actions { display:flex; justify-content:flex-end; gap:.45rem; margin-top:.75rem; }
    .card-actions button { border:1px solid #e2e8f0; background:#fff; color:#334155; border-radius:8px; padding:.38rem .65rem; font-size:.75rem; cursor:pointer; }
    .card-actions .danger { color:#dc2626; border-color:#fecaca; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      top: calc(64px + 1.5rem);
      box-sizing: border-box;
      padding: 1rem;
      overflow-y: auto;
      background: rgba(15, 23, 42, 0.45);
      display: grid;
      place-items: center;
      z-index: 50;
    }
    .modal {
      background: #fff;
      border-radius: 16px;
      padding: 1.1rem 1.25rem;
      width: min(460px, calc(100vw - 2rem));
      max-height: min(38rem, calc(100vh - 8rem));
      max-height: min(38rem, calc(100dvh - 8rem));
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .modal h2 { margin: 0; font-size: 1.15rem; }
    .modal label {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 0.3rem;
      font-size: 0.82rem;
      font-weight: 600;
      color: #334155;
    }
    .modal input, .modal textarea, .modal select {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      height: 42px;
      padding: 0.5rem 0.65rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 9px;
      font: inherit;
    }
    .modal textarea { height: auto; min-height: 56px; resize: vertical; }
    .modal input[type="range"] { height: 22px; padding: 0; }
    .project-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: .6rem;
      width: 100%;
      min-width: 0;
    }
    .modal fieldset.member-picker {
      display: block;
      flex: 0 0 auto;
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 4rem;
      max-height: 6rem;
      overflow-x: hidden;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: .5rem .75rem;
    }
    .modal .member-picker legend { padding:0 .25rem; font-size:.8rem; color:#475569; }
    .modal .member-picker label {
      display: flex;
      flex: 0 0 auto;
      flex-direction: row;
      align-items: center;
      gap: .5rem;
      width: 100%;
      min-height: 1.65rem;
      padding: .25rem 0;
      font-weight: 500;
    }
    .modal .member-picker input[type="checkbox"] {
      flex: 0 0 16px;
      width: 16px;
      height: 16px;
      margin: 0;
      padding: 0;
    }
    .modal .member-picker label > span { min-width: 0; overflow-wrap: anywhere; }
    .modal .member-picker small { margin-left:.3rem; color:#64748b; font-size:.7rem; }
    .modal-actions {
      display: flex;
      position: sticky;
      bottom: 0;
      justify-content: flex-end;
      gap: 0.5rem;
      margin: 0 -1.25rem -1.1rem;
      padding: .65rem 1.25rem 1.1rem;
      background: var(--surface, #fff);
      border-top: 1px solid var(--border, #e2e8f0);
    }
    .operation-error { padding:.65rem .8rem; border-radius:8px; background:#fef2f2; color:#b91c1c; font-size:.8rem; }
    @media (max-width: 900px) {
      .modal-backdrop { top: calc(58px + 1rem); }
      .modal { max-height: min(38rem, calc(100vh - 6rem)); max-height: min(38rem, calc(100dvh - 6rem)); }
    }
    @media (max-width: 420px) {
      .project-options { grid-template-columns: 1fr; }
    }
  `]
})
export class ProjectsComponent {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  error = signal('');
  form = { title: '', description: '', deadline: '', adviserId: '', memberIds: [] as string[], status: 'ongoing' as ProjectStatus, progress: 0 };
  projects = this.data.projects;
  advisers = computed(() => this.data.team().filter(member => member.role === 'adviser' && member.isActive !== false));
  eligibleMembers = computed(() => this.data.team().filter(member =>
    member.isActive !== false && (member.role === 'student' || member.role === 'project_leader')
  ));
  readonly visibleProjects = computed(() => {
    const user = this.auth.user();
    if (!user) return [];
    if (this.auth.hasRole('admin')) return this.projects();
    if (this.auth.hasRole('adviser')) return this.projects().filter(project => project.adviserId === user.id);
    if (this.auth.hasRole('project_leader')) return this.projects().filter(project => project.leaderId === user.id);
    return this.projects().filter(project => project.memberIds.includes(user.id));
  });

  canCreate(): boolean {
    return this.auth.hasRole('project_leader', 'admin');
  }

  pageTitle(): string {
    if (this.auth.hasRole('student')) return 'My project';
    if (this.auth.hasRole('adviser')) return 'Assigned projects';
    return 'Projects & members';
  }

  pageDescription(): string {
    if (this.auth.hasRole('student')) return 'View project progress, team feedback, and your assigned workspace.';
    if (this.auth.hasRole('adviser')) return 'Open your assigned projects and review their current progress.';
    return 'Create a project, build the team, assign an adviser, and set the delivery deadline.';
  }

  canManage(project: Project): boolean {
    const userId = this.auth.user()?.id;
    return this.auth.hasRole('admin') ||
      (this.auth.hasRole('project_leader') && project.leaderId === userId);
  }

  statusLabel(s: ProjectStatus): string {
    if (s === 'on_hold') return 'On Hold';
    if (s === 'ongoing') return 'On Going';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  latestFeedback(project: Project): string {
    const feedback = project.feedback;
    return feedback?.[feedback.length - 1] ?? '';
  }

  openCreate(): void {
    this.resetForm();
    const userId = this.auth.user()?.id;
    this.form.memberIds = userId ? [userId] : [];
    this.error.set('');
    this.showForm.set(true);
  }

  toggleMember(memberId: string, event: Event): void {
    const selected = (event.target as HTMLInputElement).checked;
    const memberIds = new Set(this.form.memberIds);
    if (selected) memberIds.add(memberId);
    else memberIds.delete(memberId);
    const currentUserId = this.auth.user()?.id;
    if (currentUserId) memberIds.add(currentUserId);
    this.form.memberIds = [...memberIds];
  }

  async create(): Promise<void> {
    const user = this.auth.user();
    if (!user || !this.form.title.trim()) {
      this.error.set('Enter a project title before creating it.');
      return;
    }
    try {
      await this.data.addProject({
        title: this.form.title.trim(),
        description: this.form.description.trim(),
        leaderId: user.id,
        memberIds: this.form.memberIds,
        adviserId: this.form.adviserId || '',
        deadline: this.form.deadline || undefined,
        color: '#3b82f6',
        status: this.form.status,
        progress: Number(this.form.progress)
      });
      this.resetForm();
    } catch (error) {
      console.error('Project creation failed.', error);
      this.error.set('Project was not created. Check your Firebase connection and permissions.');
    }
  }

  openEdit(project: Project): void {
    this.editingId.set(project.id);
    this.form = {
      title: project.title,
      description: project.description,
      deadline: project.deadline ?? '',
      adviserId: project.adviserId ?? '',
      memberIds: [...project.memberIds],
      status: project.status,
      progress: project.progress
    };
    this.showForm.set(true);
  }

  async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id || !this.form.title.trim()) return;
    try {
      await this.data.updateProject(id, {
        title: this.form.title.trim(),
        description: this.form.description.trim(),
        deadline: this.form.deadline || undefined,
        adviserId: this.form.adviserId,
        memberIds: this.form.memberIds,
        status: this.form.status,
        progress: Number(this.form.progress)
      });
      this.resetForm();
    } catch (error) {
      console.error('Project update failed.', error);
      this.error.set('Project was not updated. Check your Firebase connection and permissions.');
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    if (window.confirm('Delete this project and its assigned tasks?')) {
      try {
        await this.data.deleteProject(projectId);
      } catch (error) {
        console.error('Project deletion failed.', error);
        this.error.set('Project was not deleted. Check your Firebase connection and permissions.');
      }
    }
  }

  resetForm(): void {
    this.form = { title: '', description: '', deadline: '', adviserId: '', memberIds: [], status: 'ongoing', progress: 0 };
    this.error.set('');
    this.editingId.set(null);
    this.showForm.set(false);
  }
}
