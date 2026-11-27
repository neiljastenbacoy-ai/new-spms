import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { Project, ProjectStatus, Task, TaskStatus, UserRole } from '../../core/models/models';
import { formatTime } from '../../core/utils/date-time';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ pageTitle() }}</h1>
      </div>
      @if (canCreate()) {
        <button class="btn-primary" (click)="openCreate()">+ New Project</button>
      }
    </div>

    <label class="project-search">
      <span>Find a project</span>
      <input type="search" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
        placeholder="Search project names or descriptions" aria-label="Search projects" />
    </label>

    @if (error()) { <div class="operation-error">{{ error() }}</div> }

    @if (showForm()) {
      <div class="modal-backdrop" (click)="showForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editingId() ? 'Edit Project' : 'Create Project' }}</h2>
          @if (error()) { <div class="operation-error">{{ error() }}</div> }
          <label>Title <input [(ngModel)]="form.title" placeholder="Project title" /></label>
          <label>Description <textarea [(ngModel)]="form.description" rows="2"></textarea></label>
          <div class="project-options">
            <label>Deadline <input type="date" [(ngModel)]="form.deadline" [min]="today" /></label>
            <label>Deadline time <small>(optional)</small><input type="time" [(ngModel)]="form.deadlineTime" /></label>
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
                  <option value="ongoing">In progress</option>
                  <option value="on_hold">On hold</option>
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

    @if (viewing(); as project) {
      <div class="modal-backdrop" (click)="closeView()">
        <div class="modal project-view" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="project-view-title">
          <header class="view-head">
            <div class="view-heading">
              <span class="badge" [class]="project.status">{{ statusLabel(project.status) }}</span>
              <h2 id="project-view-title">{{ project.title }}</h2>
              <p>{{ project.description || 'No description recorded for this project.' }}</p>
            </div>
            <button class="view-close" type="button" (click)="closeView()" aria-label="Close project details">×</button>
          </header>

          <div class="view-facts">
            <div><span>Progress</span><strong>{{ project.progress }}%</strong></div>
            <div><span>Deadline</span><strong>{{ project.deadline ? formatDate(project.deadline, project.deadlineTime) : 'Not set' }}</strong></div>
            <div><span>Team</span><strong>{{ participantIdsOf(project).length }}</strong></div>
          </div>
          <div class="view-progress"><div class="track"><div class="fill" [style.width.%]="project.progress"></div></div></div>

          <section class="view-section">
            <h3>Leadership</h3>
            <ul class="people">
              <li>
                <span class="avatar">{{ initialsOf(project.leaderId) }}</span>
                <div><strong>{{ personName(project.leaderId) }}</strong><small>Project leader</small></div>
              </li>
              <li>
                @if (project.adviserId) {
                  <span class="avatar">{{ initialsOf(project.adviserId) }}</span>
                  <div><strong>{{ personName(project.adviserId) }}</strong><small>Adviser</small></div>
                } @else {
                  <span class="avatar avatar-empty">–</span>
                  <div><strong>No adviser assigned</strong><small>Ask the project leader to assign one</small></div>
                }
              </li>
            </ul>
          </section>

          <section class="view-section">
            <h3>Members <span class="section-count">{{ memberIdsOf(project).length }}</span></h3>
            <ul class="people">
              @for (id of memberIdsOf(project); track id) {
                <li>
                  <span class="avatar">{{ initialsOf(id) }}</span>
                  <div>
                    <strong>{{ personName(id) }}{{ id === auth.user()?.id ? ' · you' : '' }}</strong>
                    <small>{{ personRole(id) }}</small>
                  </div>
                </li>
              } @empty {
                <li class="people-empty">No student members have been added yet.</li>
              }
            </ul>
          </section>

          <section class="view-section">
            <h3>{{ auth.hasRole('student') ? 'Your tasks in this project' : 'Tasks on this project' }}</h3>
            @if (projectTasks(project.id).length) {
              <ul class="view-tasks">
                @for (task of projectTasks(project.id); track task.id) {
                  <li>
                    <span class="status" [class]="task.status">{{ taskStatusLabel(task.status) }}</span>
                    <a class="task-title" [routerLink]="['/tasks']"
                      [queryParams]="{ projectId: project.id, taskId: task.id }">{{ task.title }}</a>
                    <span class="task-due">{{ formatDate(task.dueDate, task.dueTime) }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="view-note">No tasks are assigned to this project yet.</p>
            }
            <a class="project-flow-link" [routerLink]="['/tasks']"
              [queryParams]="{ projectId: project.id }">Open all project tasks →</a>
          </section>

          @if (project.feedback?.length) {
            <section class="view-section">
              <h3>Adviser feedback</h3>
              @for (note of project.feedback; track $index) {
                <p class="view-note">{{ note }}</p>
              }
            </section>
          }

          <div class="modal-actions">
            <a class="btn-ghost" [routerLink]="['/deadlines']"
              [queryParams]="{ projectId: project.id }">Deadlines</a>
            @if (auth.hasRole('student', 'project_leader', 'adviser')) {
              <a class="btn-ghost" [routerLink]="['/files']"
                [queryParams]="{ projectId: project.id }">Files</a>
              <a class="btn-ghost" [routerLink]="['/contributions']"
                [queryParams]="{ projectId: project.id }">Contributions</a>
            }
            @if (canManage(project)) {
              <button type="button" class="btn-ghost" (click)="openEdit(project); closeView()">Edit project</button>
            }
            <button type="button" class="btn-primary" (click)="closeView()">Close</button>
          </div>
        </div>
      </div>
    }

    <div class="project-grid">
      @for (p of visibleProjects(); track p.id) {
        <article class="project-card" role="button" tabindex="0"
          [attr.aria-label]="'View details for ' + p.title"
          (click)="openView(p)"
          (keydown.enter)="openView(p)"
          (keydown.space)="openView(p); $event.preventDefault()">
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
              <span>{{ participantIdsOf(p).length }} on team</span>
              @if (p.deadline) {
                <span>Due {{ formatDate(p.deadline, p.deadlineTime) }}</span>
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
                <button type="button" (click)="openEdit(p); $event.stopPropagation()">Edit</button>
                <button type="button" class="danger" (click)="deleteProject(p.id); $event.stopPropagation()">Delete</button>
              </div>
            }
            <div class="card-open">
              <span>View team &amp; tasks</span>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </article>
      } @empty {
        <div class="empty-projects">
          <span class="empty-mark">▣</span>
          <h2>{{ auth.hasRole('student') ? 'No project assigned yet' : auth.hasRole('adviser') ? 'No projects assigned to you' : auth.hasRole('admin') ? 'No projects found' : 'Start a project workspace' }}</h2>
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
    .page-head h1 { margin: 0; font-size: 1.5rem; color: var(--text); }
    .page-head p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.9rem; }
    .project-search { display:grid; gap:.35rem; max-width:440px; margin:0 0 1rem; color:var(--muted); font-size:.72rem; font-weight:600; }
    .project-search input { width:100%; min-height:40px; padding:.5rem .7rem; border:1px solid var(--border); border-radius:8px; background:var(--field); color:var(--text); font:inherit; }
    .btn-primary {
      padding: 0.65rem 1.2rem;
      background: linear-gradient(135deg, var(--accent), var(--accent));
      color: #fff;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-ghost {
      padding: 0.65rem 1.2rem;
      background: var(--surface-2);
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
      background: var(--surface);
      border-radius: 16px;
      border: 1px solid var(--border);
      overflow: hidden;
      cursor: pointer;
      transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
    }
    .project-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
    .project-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .card-open {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;
      margin-top: .8rem;
      padding-top: .6rem;
      border-top: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .project-view {
      width: min(560px, calc(100vw - 2rem));
      gap: .9rem;
    }
    .view-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .view-heading { min-width: 0; }
    .view-head h2 {
      margin: .45rem 0 .35rem;
      font-family: var(--font-display);
      font-size: 1.45rem;
      font-weight: 500;
      letter-spacing: -.03em;
      line-height: 1.1;
    }
    .view-head p { margin: 0; color: var(--muted); font-size: .84rem; line-height: 1.5; }
    .view-close {
      flex: 0 0 28px;
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: 2px;
      background: var(--surface);
      color: var(--muted);
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
    }
    .view-close:hover { border-color: var(--accent); color: var(--accent); }
    .view-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; }
    .view-facts div {
      display: grid;
      gap: .12rem;
      padding: .5rem .6rem;
      border: 1px solid var(--border);
      border-radius: 2px;
      background: var(--surface-2);
      min-width: 0;
    }
    .view-facts span {
      font-family: var(--font-mono);
      font-size: .52rem;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .view-facts strong { font-size: .82rem; color: var(--text); }
    .view-progress .track { height: 5px; background: var(--border); border-radius: 999px; overflow: hidden; }
    .view-section { display: grid; gap: .4rem; }
    .view-section h3 {
      display: flex;
      align-items: center;
      gap: .45rem;
      margin: 0;
      font-family: var(--font-mono);
      font-size: .56rem;
      font-weight: 500;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .section-count {
      padding: 0 .3rem;
      border: 1px solid var(--border);
      border-radius: 2px;
      color: var(--ink-soft);
    }
    .people { list-style: none; margin: 0; padding: 0; display: grid; gap: .3rem; }
    .people li {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .4rem .5rem;
      border: 1px solid var(--border);
      border-radius: 2px;
      background: var(--surface);
    }
    .people .avatar { width: 28px; height: 28px; flex: 0 0 28px; font-size: .58rem; }
    .avatar-empty { color: var(--muted) !important; }
    .people strong { display: block; font-size: .8rem; font-weight: 600; color: var(--text); }
    .people small {
      font-family: var(--font-mono);
      font-size: .52rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .people-empty { color: var(--muted); font-size: .78rem; border-style: dashed; }
    .view-tasks { list-style: none; margin: 0; padding: 0; display: grid; }
    .view-tasks li {
      display: grid;
      grid-template-columns: minmax(6rem, auto) minmax(0, 1fr) auto;
      align-items: center;
      gap: .55rem;
      padding: .38rem .1rem;
      border-bottom: 1px dotted var(--border);
      font-size: .78rem;
    }
    .view-tasks li:last-child { border-bottom: 0; }
    .task-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); text-decoration:none; }
    .task-title:hover { color:var(--accent); text-decoration:underline; }
    .project-flow-link { justify-self:start; color:var(--accent); font-size:.72rem; font-weight:700; text-decoration:none; }
    .project-flow-link:hover { text-decoration:underline; text-underline-offset:3px; }
    .task-due { font-family: var(--font-mono); font-size: .58rem; color: var(--muted); white-space: nowrap; }
    .view-note {
      margin: 0;
      padding: .5rem .65rem;
      border-left: 2px solid var(--accent);
      background: var(--surface-2);
      color: var(--ink-soft);
      font-size: .79rem;
      line-height: 1.5;
    }
    .card-top {
      padding: 1.25rem;
      border-top: 4px solid var(--accent);
    }
    .badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    .badge.ongoing { background: var(--surface-2); color: var(--moss); }
    .badge.on_hold { background: var(--accent-soft); color: var(--ochre); }
    .badge.completed { background: var(--surface-2); color: var(--accent); }
    .badge.overdue { background: var(--danger-soft); color: var(--danger); }
    .card-top h3 { margin: 0 0 0.4rem; font-size: 1.05rem; color: var(--text); }
    .card-top p { margin: 0; font-size: 0.85rem; color: var(--muted); line-height: 1.4; }
    .card-meta { padding: 0 1.25rem 1.25rem; }
    .progress-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .track {
      flex: 1;
      height: 8px;
      background: var(--border);
      border-radius: 999px;
      overflow: hidden;
    }
    .fill { height: 100%; border-radius: 999px; }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .latest-feedback { margin-top:.75rem; padding:.7rem; border-left:3px solid var(--accent); border-radius:0 9px 9px 0; background:var(--surface-soft,var(--surface-2)); }
    .latest-feedback strong { color:var(--text,var(--text)); font-size:.72rem; }
    .latest-feedback p { margin:.3rem 0 0; color:var(--muted,var(--muted)); font-size:.76rem; line-height:1.45; }
    .empty-projects { display:grid; justify-items:center; grid-column:1/-1; gap:.5rem; padding:3rem 1.25rem; border:1px dashed var(--border,var(--border)); border-radius:16px; background:var(--surface,#fff); text-align:center; }
    .empty-mark { display:grid; width:46px; height:46px; place-items:center; border-radius:14px; background:var(--surface-2); color:var(--accent); }
    .empty-projects h2 { margin:.3rem 0 0; color:var(--text,var(--text)); font-size:1rem; }
    .empty-projects p { max-width:440px; margin:0; color:var(--muted,var(--muted)); font-size:.82rem; line-height:1.5; }
    .card-actions { display:flex; justify-content:flex-end; gap:.45rem; margin-top:.75rem; }
    .card-actions button { border:1px solid var(--border); background: var(--surface); color:var(--ink-soft); border-radius:8px; padding:.38rem .65rem; font-size:.75rem; cursor:pointer; }
    .card-actions .danger { color:var(--danger); border-color:var(--danger-soft); }
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
      background: var(--surface);
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
      color: var(--ink-soft);
    }
    .modal input, .modal textarea, .modal select {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      height: 42px;
      padding: 0.5rem 0.65rem;
      border: 1.5px solid var(--border);
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
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: .5rem .75rem;
    }
    .modal .member-picker legend { padding:0 .25rem; font-size:.8rem; color:var(--ink-soft); }
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
    .modal .member-picker small { margin-left:.3rem; color:var(--muted); font-size:.7rem; }
    .modal-actions {
      display: flex;
      position: sticky;
      bottom: 0;
      justify-content: flex-end;
      gap: 0.5rem;
      margin: 0 -1.25rem -1.1rem;
      padding: .65rem 1.25rem 1.1rem;
      background: var(--surface, #fff);
      border-top: 1px solid var(--border, var(--border));
    }
    .operation-error { padding:.65rem .8rem; border-radius:8px; background:var(--danger-soft); color:var(--danger); font-size:.8rem; }
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  readonly today = new Date().toISOString().slice(0, 10);
  error = signal('');
  form = { title: '', description: '', deadline: '', deadlineTime: '', adviserId: '', memberIds: [] as string[], status: 'ongoing' as ProjectStatus, progress: 0 };
  readonly searchQuery = signal('');
  private readonly pendingProjectId = signal<string | null>(null);
  projects = this.data.projects;
  advisers = computed(() => this.data.team().filter(member => member.role === 'adviser' && member.isActive !== false));
  eligibleMembers = computed(() => this.data.team().filter(member =>
    member.isActive !== false && (member.role === 'student' || member.role === 'project_leader')
  ));
  readonly visibleProjects = computed(() => {
    const user = this.auth.user();
    if (!user) return [];
    const accessibleProjects = this.auth.hasRole('admin')
      ? this.projects()
      : this.auth.hasRole('adviser')
        ? this.projects().filter(project => project.adviserId === user.id)
        : this.auth.hasRole('project_leader')
          ? this.projects().filter(project => project.leaderId === user.id)
          : this.projects().filter(project => project.memberIds.includes(user.id));
    const query = this.searchQuery().trim().toLowerCase();
    return accessibleProjects.filter(project =>
      !query
      || project.title.toLowerCase().includes(query)
      || project.description.toLowerCase().includes(query)
    );
  });

  readonly viewingId = signal<string | null>(null);
  /** Looked up from the live list so the panel reflects edits and deletes. */
  readonly viewing = computed<Project | null>(() => {
    const id = this.viewingId();
    return id ? this.projects().find(project => project.id === id) ?? null : null;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.searchQuery.set(params.get('q') ?? '');
      this.pendingProjectId.set(params.get('projectId'));
    });
    effect(() => {
      const projectId = this.pendingProjectId();
      if (projectId && this.projects().some(project => project.id === projectId)) {
        this.viewingId.set(projectId);
      }
    });
  }

  canCreate(): boolean {
    return this.auth.hasRole('project_leader');
  }

  openView(project: Project): void {
    this.viewingId.set(project.id);
  }

  closeView(): void {
    this.viewingId.set(null);
    if (this.pendingProjectId()) {
      this.pendingProjectId.set(null);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { projectId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  /** Members list without the leader and adviser, who are shown under Leadership. */
  memberIdsOf(project: Project): string[] {
    return (project.memberIds ?? []).filter(id => id !== project.leaderId && id !== project.adviserId);
  }

  /** Everyone attached to the project: leader, adviser and student members, deduplicated. */
  participantIdsOf(project: Project): string[] {
    const ids: Array<string | undefined> = [project.leaderId, project.adviserId, ...(project.memberIds ?? [])];
    return [...new Set(ids.filter((id): id is string => !!id))];
  }

  personName(id: string): string {
    return this.data.team().find(member => member.id === id)?.name ?? 'Unknown member';
  }

  personRole(id: string): string {
    const role = this.data.team().find(member => member.id === id)?.role;
    return this.roleLabel(role);
  }

  initialsOf(id: string): string {
    return this.personName(id)
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  }

  roleLabel(role: UserRole | undefined): string {
    if (role === 'project_leader') return 'Project leader';
    if (role === 'adviser') return 'Adviser';
    if (role === 'admin') return 'Administrator';
    return 'Student';
  }

  projectTasks(projectId: string): Task[] {
    return this.data.tasks()
      .filter(task => task.projectId === projectId)
      .slice(0, 8);
  }

  taskStatusLabel(status: TaskStatus): string {
    if (status === 'in_progress') return 'In progress';
    if (status === 'todo') return 'To do';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  formatDate(value: string, time?: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'No date';
    const label = new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const clock = formatTime(time);
    return clock ? `${label} · ${clock}` : label;
  }

  pageTitle(): string {
    if (this.auth.hasRole('student')) return 'My project';
    if (this.auth.hasRole('adviser')) return 'Assigned projects';
    return 'Projects & members';
  }

  canManage(project: Project): boolean {
    const userId = this.auth.user()?.id;
    return this.auth.hasRole('project_leader') && project.leaderId === userId;
  }

  statusLabel(s: ProjectStatus): string {
    if (s === 'on_hold') return 'On hold';
    if (s === 'ongoing') return 'In progress';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  latestFeedback(project: Project): string {
    const feedback = project.feedback;
    return feedback?.[feedback.length - 1] ?? '';
  }

  openCreate(): void {
    if (!this.canCreate()) return;
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
    if (!this.canCreate()) {
      this.error.set('Only project leaders can create projects.');
      return;
    }
    const user = this.auth.user();
    if (!user || !this.form.title.trim()) {
      this.error.set('Enter a project title before creating it.');
      return;
    }
    if (this.form.deadline && this.form.deadline < this.today) {
      this.error.set('The deadline cannot be in the past.');
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
        deadlineTime: this.form.deadlineTime || undefined,
        color: 'var(--accent)',
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
      deadlineTime: project.deadlineTime ?? '',
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
    if (this.form.deadline && this.form.deadline < this.today) {
      this.error.set('The deadline cannot be in the past.');
      return;
    }
    try {
      await this.data.updateProject(id, {
        title: this.form.title.trim(),
        description: this.form.description.trim(),
        deadline: this.form.deadline || undefined,
        deadlineTime: this.form.deadlineTime || undefined,
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
    if (window.confirm('Delete this project, its tasks, shared files, comments, and activity history?')) {
      try {
        await this.data.deleteProject(projectId);
      } catch (error) {
        console.error('Project deletion failed.', error);
        this.error.set(error instanceof Error && error.message.startsWith('Project deleted, but browser-local files')
          ? error.message
          : 'Project was not deleted. Check your Firebase connection and permissions.');
      }
    }
  }

  resetForm(): void {
    this.form = { title: '', description: '', deadline: '', deadlineTime: '', adviserId: '', memberIds: [], status: 'ongoing', progress: 0 };
    this.error.set('');
    this.editingId.set(null);
    this.showForm.set(false);
  }
}
