import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { Task, TaskStatus, User, UserRole } from '../../core/models/models';
import { dueSortKey, formatTime, isValidTime } from '../../core/utils/date-time';

/** Sort order for the task list: high first, then medium, then low. */
const PRIORITY_RANK: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ auth.hasRole('student') ? 'My tasks' : auth.hasRole('adviser') ? 'Task reviews' : auth.hasRole('admin') ? 'All tasks' : 'Project tasks' }}</h1>
      </div>
      @if (canManageTasks()) {
        <button class="add-btn" type="button" (click)="openCreate()">
          + New task
        </button>
      }
    </div>

    @let rows = filteredTasks();

    <div class="toolbar">
      <label class="search-field">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input type="search" [(ngModel)]="search" placeholder="Search tasks or projects" aria-label="Search tasks or projects" />
      </label>
      <select [(ngModel)]="statusFilter" aria-label="Filter tasks by status">
        <option value="all">All statuses</option>
        <option value="todo">To do</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
        <option value="overdue">Overdue</option>
      </select>
      <span class="count">{{ rows.length }} {{ rows.length === 1 ? 'task' : 'tasks' }}</span>
      <span class="sort-note">Sorted by priority, then deadline</span>
    </div>
    @if (projectFilter() || taskFilter()) {
      <div class="context-filter">
        <span>{{ taskFilter() ? 'Showing the linked task' : 'Showing tasks for ' + projectTitle(projectFilter()) }}</span>
        @if (projectFilter()) {
          <a [routerLink]="['/projects']" [queryParams]="{ projectId: projectFilter() }">Open project</a>
        }
        <button type="button" (click)="clearRouteContext()">Show all tasks</button>
      </div>
    }
    @if (actionError()) { <div class="action-error">{{ actionError() }}</div> }

    @if (showForm()) {
      <div class="modal-backdrop" (click)="showForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Create task</h2>
          @if (actionError()) { <div class="action-error">{{ actionError() }}</div> }
          <label
            >Task title
            <input
              [(ngModel)]="form.title"
              placeholder="What needs to be done?"
          /></label>
          <label
            >Project
            <select [(ngModel)]="form.projectId" (ngModelChange)="selectProject($event)">
              <option value="">Select a project</option>
              @for (project of data.projects(); track project.id) {
                <option [value]="project.id">{{ project.title }}</option>
              }
            </select>
          </label>
          <label
            >Assignee
            <select [(ngModel)]="form.assigneeId">
              <option value="">Select a team member</option>
              @for (member of teamForSelectedProject(); track member.id) {
                <option [value]="member.id">{{ member.name }}</option>
              }
            </select>
          </label>
          <label
            >Priority
            <select [(ngModel)]="form.priority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label
            >Due date <input type="date" [(ngModel)]="form.dueDate"
              [min]="tomorrow"
          /></label>
          <label>Due time <small>(optional)</small>
            <input type="time" [(ngModel)]="form.dueTime" />
          </label>
          <div class="modal-actions">
            <button type="button" class="cancel" (click)="showForm.set(false)">
              Cancel
            </button>
            <button type="button" class="save" (click)="create()">
              Create task
            </button>
          </div>
        </div>
      </div>
    }

    @if (adjustTask(); as task) {
      <div class="modal-backdrop" (click)="closeAdjust()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Adjust task</h2>
          <p class="modal-sub">{{ task.title }} · {{ projectTitle(task.projectId) }}</p>
          <label>Priority
            <select [(ngModel)]="adjustForm.priority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>Due date
            <input type="date" [(ngModel)]="adjustForm.dueDate" [min]="tomorrow" />
          </label>
          @if (canManageTasks()) {
            <label>Due time <small>(optional)</small>
              <input type="time" [(ngModel)]="adjustForm.dueTime" />
            </label>
          }
          @if (adjustError()) { <div class="action-error">{{ adjustError() }}</div> }
          <div class="modal-actions">
            <button type="button" class="cancel" (click)="closeAdjust()">Cancel</button>
            <button type="button" class="save" (click)="saveAdjust()">Save changes</button>
          </div>
        </div>
      </div>
    }

    @if (reviewTask(); as task) {
      <div class="modal-backdrop" (click)="closeReview()">
        <div class="modal review-modal" (click)="$event.stopPropagation()">
          <h2>Task feedback</h2>
          <p class="modal-sub">{{ task.title }} · due {{ formatDue(task.dueDate, task.dueTime) }}</p>
          <div class="comment-list">
            @for (comment of commentsFor(task.id); track comment.id) {
              <article class="comment">
                <header>
                  <strong>{{ comment.authorName }}</strong>
                  <span>{{ roleLabel(comment.authorRole) }} · {{ shortTime(comment.createdAt) }}</span>
                </header>
                <p>{{ comment.body }}</p>
              </article>
            } @empty {
              <p class="comment-empty">No feedback on this task yet.</p>
            }
          </div>
          @if (canReviewTask(task)) {
            @if (reviewOpen(task)) {
              <textarea
                [(ngModel)]="commentDraft"
                maxlength="2000"
                placeholder="Leave guidance for this task..."
              ></textarea>
              @if (commentError()) { <div class="action-error">{{ commentError() }}</div> }
            } @else {
              <p class="closed-note">Review closed — this task is past its due date.</p>
            }
          }
          <div class="modal-actions">
            <button type="button" class="cancel" (click)="closeReview()">Close</button>
            @if (canReviewTask(task) && reviewOpen(task)) {
              <button type="button" class="save" (click)="submitComment(task.id)">Post comment</button>
            }
          </div>
        </div>
      </div>
    }

    <div class="task-table">
      <div class="thead" aria-hidden="true">
        <span>Task</span>
        <span>Project</span>
        <span>Priority</span>
        <span>Deadline</span>
        <span>Status</span>
        <span class="th-actions">Actions</span>
      </div>
      @for (t of rows; track t.id) {
        <div class="trow" [class.done]="t.status === 'completed'">
          <span class="title" data-label="Task">{{ t.title }}</span>
          <a class="muted project-link" data-label="Project"
            [routerLink]="['/projects']" [queryParams]="{ projectId: t.projectId }">
            {{ projectTitle(t.projectId) }}
          </a>
          <span class="prio" [class]="t.priority" data-label="Priority">
            <span class="prio-dot" aria-hidden="true"></span>{{ priorityLabel(t.priority) }}
          </span>
          @if (t.status !== 'completed') {
            <a class="due due-link" [class.late]="isOverdue(t)" [attr.datetime]="t.dueDate + (t.dueTime ? 'T' + t.dueTime : '')"
              [routerLink]="['/deadlines']" [queryParams]="{ projectId: t.projectId, taskId: t.id }"
              data-label="Deadline">{{ formatDue(t.dueDate, t.dueTime) }}</a>
          } @else {
            <time class="due" [attr.datetime]="t.dueDate + (t.dueTime ? 'T' + t.dueTime : '')"
              data-label="Deadline">{{ formatDue(t.dueDate, t.dueTime) }}</time>
          }
          <span class="status" [class]="displayStatus(t)" data-label="Status">{{ statusLabel(displayStatus(t)) }}</span>
          <div class="actions" data-label="Actions">
            @if (t.status !== 'completed') {
              @if (canActOnTask(t)) {
                @if (t.status === 'todo' || isOverdue(t)) {
                  <button type="button" (click)="start(t.id)">Start</button>
                }
                @if (t.status === 'in_progress') {
                  <button type="button" (click)="complete(t.id)">Complete</button>
                }
              }
            }
            @if (canActOnTask(t)) {
              <button type="button" class="ghost" (click)="openAdjust(t)">Adjust</button>
            }
            @if (canViewTask(t)) {
              <button type="button" class="ghost" (click)="openReview(t)">
                {{ canReviewTask(t) ? 'Review' : 'Feedback' }} ({{ commentCount(t.id) }})
              </button>
            }
          </div>
        </div>
      }
      @empty {
        <div class="empty-row">{{ search || statusFilter !== 'all' ? 'No tasks match the current filters.' : 'No tasks available.' }}</div>
      }
    </div>
  `,
  styles: [
    `
      .page-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.25rem;
      }
      .page-head h1 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--text);
      }
      .page-head p {
        margin: 0.25rem 0 0;
        color: var(--muted);
        font-size: 0.9rem;
      }
      .add-btn,
      .save {
        border: 0;
        border-radius: 9px;
        background: var(--accent);
        color: #fff;
        padding: 0.55rem 0.85rem;
        font-weight: 700;
        cursor: pointer;
      }
      .action-error {
        margin-bottom: 0.75rem;
        padding: 0.65rem 0.8rem;
        border-radius: 8px;
        background: var(--danger-soft);
        color: var(--danger);
        font-size: 0.8rem;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.9rem;
        flex-wrap: wrap;
      }
      .context-filter {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: .65rem;
        margin: -.25rem 0 .85rem;
        padding: .65rem .8rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface-2);
        color: var(--ink-soft);
        font-size: .78rem;
      }
      .context-filter a,
      .context-filter button {
        border: 0;
        padding: 0;
        background: transparent;
        color: var(--accent);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .context-filter button { margin-left: auto; }
      .project-link { text-decoration: none; }
      .project-link:hover { color: var(--accent); text-decoration: underline; }
      .search-field {
        position: relative;
        flex: 1 1 16rem;
        min-width: 0;
      }
      .search-icon {
        position: absolute;
        left: 0.7rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--muted);
        font-size: 0.95rem;
        pointer-events: none;
      }
      .toolbar input,
      .toolbar select {
        height: 38px;
        border: 1px solid var(--border);
        border-radius: 3px;
        background: var(--field);
        color: var(--text);
        padding: 0 0.7rem;
        font-size: 0.82rem;
      }
      .search-field input { width: 100%; padding-left: 2.05rem; }
      .toolbar select { flex: 0 0 auto; min-width: 9.5rem; }
      .count {
        flex: 0 0 auto;
        padding: 0.3rem 0.5rem;
        border: 1px solid var(--border);
        border-radius: 2px;
        font-family: var(--font-mono);
        font-size: 0.58rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        white-space: nowrap;
      }
      .sort-note {
        flex: 0 0 auto;
        font-family: var(--font-mono);
        font-size: 0.55rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        white-space: nowrap;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 60;
        background: rgba(15, 23, 42, 0.48);
        display: grid;
        place-items: center;
      }
      .modal {
        width: min(460px, 92vw);
        background: var(--surface);
        border-radius: 16px;
        padding: 1.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.24);
      }
      .modal h2 {
        margin: 0 0 0.25rem;
      }
      .modal label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        color: var(--ink-soft);
        font-size: 0.82rem;
        font-weight: 700;
      }
      .modal input,
      .modal select {
        height: 42px;
        border: 1px solid var(--border);
        border-radius: 9px;
        padding: 0.5rem 0.65rem;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }
      .modal-actions button {
        border-radius: 8px;
        padding: 0.55rem 0.8rem;
        cursor: pointer;
      }
      .cancel {
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--ink-soft);
      }
      .task-table {
        background: var(--surface);
        border-radius: 16px;
        border: 1px solid var(--border);
        overflow: hidden;
      }
      #host { background: #F6F0E4; }
      .task-table {
        background: transparent;
        border: 0;
        border-radius: 0;
        overflow: visible;
      }
      .thead,
      .trow {
        display: grid;
        grid-template-columns: minmax(0, 1.9fr) minmax(0, 1.2fr) minmax(5rem, 0.7fr) minmax(5.6rem, 0.8fr) minmax(7rem, 0.85fr) minmax(9rem, auto);
        gap: 1.1rem;
        padding: 0.72rem 1.05rem;
        align-items: center;
        font-size: 0.82rem;
      }

      .th-actions { text-align: right; }
      .thead {
        background: #EFE8DA;
        border-bottom: 1px solid rgba(26,51,41,0.09);
        color: rgba(26,51,41,0.55);
        font-weight: 600;
        font-size: 0.62rem;
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding: 0.6rem 1.05rem;
      }
      .trow {
        background: #FFFFFF;
        border-bottom: 1px solid rgba(26,51,41,0.08);
        border-radius: 7px;
        padding: 0.72rem 1.05rem;
        box-shadow: 0 1px 0 rgba(26,51,41,0.02);
      }
      .trow:last-child { border-bottom: 0; }
      .title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
        color: var(--text);
        font-family: var(--body);
        font-size: 0.86rem;
        line-height: 1.4;
      }

      .trow.done .title {
        color: var(--muted);
        text-decoration: line-through;
        text-decoration-color: rgba(26,51,41,0.45);
        text-decoration-thickness: 1.5px;
      }

      .due {
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.04em;
        color: rgba(26,51,41,0.65);
        white-space: nowrap;
        line-height: 1.45;
      }

      .due.late { color: var(--danger); font-weight: 600; }
      .due-link { text-decoration:none; }
      .due-link:hover { color:var(--accent); text-decoration:underline; }
      .muted {
        color: rgba(26,51,41,0.55);
        font-size: 0.78rem;
        line-height: 1.4;
      }
      .prio {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        width: fit-content;
        font-family: var(--font-mono);
        font-size: 0.58rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-soft);
        border-width: 1px;
        border-radius: 999px;
        padding: 0.26rem 0.6rem;
        line-height: 1;
      }
      .prio-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--line-strong);
        flex: 0 0 6px;
        margin: 0;
      }
      .prio.high { color: #B04A2E; border-color: #B04A2E; }
      .prio.high .prio-dot { background: #B04A2E; }
      .prio.medium { color: #A65D2A; border-color: #A65D2A; }
      .prio.medium .prio-dot { background: #A65D2A; }
      .prio.low { color: rgba(26,51,41,0.55); border-color: rgba(26,51,41,0.22); }
      .prio.low .prio-dot { background: rgba(26,51,41,0.28); }
      .status {
        font-size: 0.6rem;
        font-weight: 700;
        padding: 0.28rem 0.62rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        position: relative;
        font-family: var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-soft);
        background: #fff;
        line-height: 1.5;
        display: inline-flex;
        justify-content: center;
        text-align: center;
      }
      .status.todo { border-color: rgba(26,51,41,0.22); color: rgba(26,51,41,0.7); }
      .status.in_progress { border-color: var(--accent); color: var(--accent); }
      .status.completed { border-color: rgba(46,125,79,0.45); color: var(--moss); }
      .status.overdue { border-color: var(--danger); color: var(--danger); }
      .empty-row { padding:2.5rem 1rem; color:rgba(26,51,41,0.65); text-align:center; font-size:.82rem; }
      .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.4rem;
      }
      .actions button {
        padding: 0.32rem 0.6rem;
        border-radius: 999px;
        border: 1px solid rgba(26,51,41,0.2);
        background: #fff;
        color: rgba(26,51,41,0.82);
        font-size: 0.64rem;
        font-weight: 600;
        font-family: var(--font-mono);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background .14s ease, color .14s ease, border-color .14s ease;
        min-height: 28px;
        text-align: center;
        line-height: 1.3;
      }
      .actions button:hover { background: #F3EDE0; border-color: var(--accent); color: var(--accent); }
      .actions button.ghost {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--ink-soft);
        text-align: center;
      }
      .actions button.ghost:hover { border-color:var(--accent); color:var(--accent); }
      
      .modal-sub { margin:-.35rem 0 0; color:var(--muted); font-size:.78rem; }
      .review-modal { width:min(520px, 94vw); }
      .comment-list {
        display:flex; flex-direction:column; gap:.55rem;
        max-height:280px; overflow-y:auto; padding-right:.15rem;
      }
      .comment { padding:.6rem .7rem; border:1px solid var(--border); border-radius:10px; background:var(--surface-2); }
      .comment header { display:flex; align-items:baseline; justify-content:space-between; gap:.5rem; }
      .comment header strong { font-size:.78rem; color:var(--text); }
      .comment header span { font-size:.68rem; color:var(--muted); text-transform:capitalize; }
      .comment p { margin:.3rem 0 0; font-size:.8rem; color:var(--ink-soft); line-height:1.45; white-space:pre-wrap; }
      .comment-empty { margin:0; padding:.85rem 0; color:var(--muted); font-size:.8rem; text-align:center; }
      .closed-note { margin:0; padding:.6rem .7rem; border-radius:8px; background:var(--danger-soft); color:var(--danger); font-size:.78rem; }
      .review-modal textarea {
        width:100%; min-height:76px; resize:vertical;
        border:1px solid var(--border); border-radius:9px; padding:.55rem .65rem;
        font:inherit; font-size:.82rem; color:var(--ink-soft);
      }

      /* Narrow screens: each task becomes a small labelled card instead of a
         cramped six-column row. No horizontal scrolling. */
      @media (max-width: 820px) {
        .toolbar { flex-direction: column; align-items: stretch; }
        .toolbar select { width: 100%; min-width: 0; }
        .sort-note { display: none; }
        .count { align-self: flex-start; }
        .thead { display: none; }
        .trow {
          grid-template-columns: 1fr;
          gap: .32rem;
          padding: .9rem 1rem;
          align-items: start;
        }
        .trow > [data-label] {
          display: grid;          align-items: center;
          grid-template-columns: 5rem 1fr;
          gap: 0.55rem;
        }
        .trow > [data-label]::before {
          content: attr(data-label);
          font-family: var(--font-mono);
          font-size: .56rem;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(26,51,41,0.55);
          align-self: end;
          padding-bottom: 0.18rem;
          text-align: left;
        }
        .trow .title {
          grid-column: 2;
          display: block;
          font-size: .9rem;
          white-space: normal;
          overflow: visible;
          text-align: left;
        }
      .trow .muted {
        grid-column: 2;
        font-size: .82rem;
        line-height: 1.4;
        color: rgba(26,51,41,0.6);
        text-align: left;
      }
        .trow .prio {
          grid-column: 2;
          justify-self: start;
          text-align: left;
        }
      .trow .due {
        grid-column: 2;
        font-family: var(--font-mono);
        font-size: .66rem;
        letter-spacing: .03em;
        color: rgba(26,51,41,0.68);
        white-space: nowrap;
        line-height: 1.5;
        text-align: left;
      }
      .trow .status {
        grid-column: 2;
        justify-self: start;
      }
      .trow .actions {
        grid-column: 2;
        justify-content: flex-start;
        align-items: center;
      }
        .trow .title::before,
        .trow .muted::before,
        .trow .prio::before,
        .trow .due::before,
        .trow .status::before,
        .trow .actions::before { display: none; }
      }
    `,
  ],
})
export class TasksComponent {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  tasks = this.data.tasks;
  showForm = signal(false);
  search = '';
  statusFilter = 'all';
  readonly projectFilter = signal('');
  readonly taskFilter = signal('');
  readonly actionError = signal('');
  /** Earliest selectable day in the picker: tomorrow. Today is not an option. */  readonly today = new Date().toISOString().slice(0, 10);
  readonly tomorrow = (() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return next.toISOString().slice(0, 10);
  })();




















































































    readonly adjustTask = signal<Task | null>(null);
  readonly adjustError = signal('');
  readonly reviewTask = signal<Task | null>(null);
  readonly commentError = signal('');
  adjustForm: Pick<Task, 'priority' | 'dueDate'> & { dueTime?: string } = { priority: 'medium', dueDate: '', dueTime: '' };
  commentDraft = '';
  form = {
    title: '',
    projectId: '',
    assigneeId: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
    dueTime: '',
  };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.projectFilter.set(params.get('projectId') ?? '');
      this.taskFilter.set(params.get('taskId') ?? '');
      this.search = params.get('q') ?? '';
    });
  }

  filteredTasks(): Task[] {
    const query = this.search.trim().toLowerCase();
    const user = this.auth.user();
    const today = new Date().toISOString().slice(0, 10);
    const roleVisibleTasks = this.tasks().filter((task) => {
      if (!user) return false;
      if (this.auth.hasRole('admin')) return true;
      if (this.auth.hasRole('project_leader')) {
        return (
          this.data.projects().find((project) => project.id === task.projectId)
            ?.leaderId === user.id
        );
      }
      if (this.auth.hasRole('adviser')) {
        return (
          this.data.projects().find((project) => project.id === task.projectId)
            ?.adviserId === user.id
        );
      }
      return task.assigneeId === user.id;
    });

    return roleVisibleTasks
      .filter((task) => {
        const overdue = task.status === 'overdue' ||
          (task.status !== 'completed' && task.dueDate < today);
        const matchesStatus = this.statusFilter === 'all' ||
          (this.statusFilter === 'overdue' ? overdue : task.status === this.statusFilter);
        const matchesQuery =
          !query ||
          task.title.toLowerCase().includes(query) ||
          this.projectTitle(task.projectId).toLowerCase().includes(query);
        const matchesProject = !this.projectFilter() || task.projectId === this.projectFilter();
        const matchesTask = !this.taskFilter() || task.id === this.taskFilter();
        return matchesStatus && matchesQuery && matchesProject && matchesTask;
      })
      // Reading order: highest priority first, then the nearest deadline,
      // then alphabetical so equal rows never shuffle between renders.
      .sort((a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        || dueSortKey(a.dueDate || '9999-12-31', a.dueTime)
          .localeCompare(dueSortKey(b.dueDate || '9999-12-31', b.dueTime))
        || a.title.localeCompare(b.title)
      );
  }

  clearRouteContext(): void {
    this.projectFilter.set('');
    this.taskFilter.set('');
    this.search = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null, projectId: null, taskId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  canManageTasks(): boolean {
    return this.auth.hasRole('project_leader');
  }

  /** Latest selectable day for a new task: its project's deadline, if one is set. */
  selectedProjectDeadline(): string {
    const project = this.data.projects().find(item => item.id === this.form.projectId);
    return project?.deadline && /^\d{4}-\d{2}-\d{2}$/.test(project.deadline) ? project.deadline : '';
  }

  /** Latest selectable day for an adjusted task: its project's deadline, if one is set. */
  projectDeadline(projectId?: string): string {
    const project = this.data.projects().find(item => item.id === projectId);
    return project?.deadline && /^\d{4}-\d{2}-\d{2}$/.test(project.deadline) ? project.deadline : '';
  }

  openCreate(): void {
    this.actionError.set('');
    const projectId = this.projectFilter();
    this.form = { title: '', projectId, assigneeId: '', priority: 'medium', dueDate: '', dueTime: '' };
    if (projectId) this.selectProject(projectId);
    this.showForm.set(true);
  }

  selectProject(projectId: string): void {
    this.form.projectId = projectId;
    if (!this.teamForSelectedProject().some(member => member.id === this.form.assigneeId)) {
      this.form.assigneeId = '';
    }
  }

  teamForSelectedProject(): User[] {
    const project = this.data.projects().find(item => item.id === this.form.projectId);
    if (!project) return [];
    return this.data.team().filter(member =>
      member.isActive !== false
      && (member.role === 'student' || member.role === 'project_leader')
      && (member.id === project.leaderId || project.memberIds.includes(member.id))
    );
  }

  canActOnTask(task: Task): boolean {
    const user = this.auth.user();
    if (!user) return false;
    if (this.auth.hasRole('project_leader')) {
      return (
        this.data.projects().find((project) => project.id === task.projectId)
          ?.leaderId === user.id
      );
    }
    return task.assigneeId === user.id;
  }

  /** Adviser or project leader may leave task-level review notes. */
  canReviewTask(task: Task): boolean {
    const user = this.auth.user();
    if (!user) return false;
    const project = this.data.projects().find((item) => item.id === task.projectId);
    return project?.adviserId === user.id || project?.leaderId === user.id;
  }

  reviewOpen(task: Task): boolean {
    return task.dueDate >= this.today;
  }

  commentsFor(taskId: string) {
    return this.data.taskComments().filter((comment) => comment.taskId === taskId);
  }

  commentCount(taskId: string): number {
    return this.data.taskComments().filter((comment) => comment.taskId === taskId).length;
  }

  openAdjust(task: Task): void {
    if (!this.canActOnTask(task)) return;
    this.adjustError.set('');
    this.adjustForm = { priority: task.priority, dueDate: task.dueDate, dueTime: task.dueTime ?? '' };
    this.adjustTask.set(task);
  }

  closeAdjust(): void {
    this.adjustTask.set(null);
    this.adjustError.set('');
  }

  async saveAdjust(): Promise<void> {
    const task = this.adjustTask();
    if (!task) return;
    const { dueDate, priority } = this.adjustForm;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      this.adjustError.set('Choose a due date.');
      return;
    }
    if (dueDate < this.tomorrow) {
      this.adjustError.set('The due date cannot be today or earlier.');
      return;
    }
    const maxDue = this.projectDeadline(task.projectId);
    if (maxDue && dueDate > maxDue) {
      this.adjustError.set('The due date cannot be later than the project deadline.');
      return;
    }
    const canSetTime = this.canManageTasks();
    if (canSetTime && this.adjustForm.dueTime && !isValidTime(this.adjustForm.dueTime)) {
      this.adjustError.set('Choose a valid due time.');
      return;
    }
    this.adjustError.set('');
    try {
      await this.data.updateTaskDetails(task.id, {
        priority,
        dueDate,
        ...(canSetTime ? { dueTime: this.adjustForm.dueTime ?? '' } : {})
      });
      this.closeAdjust();
    } catch (error) {
      console.error('Task adjustment failed.', error);
      this.adjustError.set(
        error instanceof Error
          ? error.message
          : 'The task was not updated. Check your access and Firestore rules.'
      );
    }
  }

  /** Assignees may read feedback on their own task; reviewers may read and write it. */
  canViewTask(task: Task): boolean {
    return this.canReviewTask(task) || task.assigneeId === this.auth.user()?.id;
  }

  openReview(task: Task): void {
    if (!this.canViewTask(task)) return;
    this.commentError.set('');
    this.commentDraft = '';
    this.reviewTask.set(task);
  }

  closeReview(): void {
    this.reviewTask.set(null);
    this.commentDraft = '';
    this.commentError.set('');
  }

  async submitComment(taskId: string): Promise<void> {
    if (!this.commentDraft.trim()) {
      this.commentError.set('Write a comment before posting.');
      return;
    }
    this.commentError.set('');
    try {
      await this.data.addTaskComment(taskId, this.commentDraft);
      this.commentDraft = '';
    } catch (error) {
      console.error('Task comment failed.', error);
      this.commentError.set(
        error instanceof Error
          ? error.message
          : 'The comment was not saved. Check your access and Firestore rules.'
      );
    }
  }

  roleLabel(role: UserRole): string {
    if (role === 'project_leader') return 'Project leader';
    if (role === 'adviser') return 'Adviser';
    if (role === 'admin') return 'Administrator';
    return 'Student';
  }

  shortTime(value: string): string {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  projectTitle(id: string): string {
    return this.data.projects().find((p) => p.id === id)?.title ?? '—';
  }

  statusLabel(s: TaskStatus): string {
    if (s === 'in_progress') return 'In progress';
    if (s === 'todo') return 'To do';
    if (s === 'overdue') return 'Overdue';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  priorityLabel(priority: Task['priority']): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  /** Compact, human deadline: `Today · 5:00 PM`, `Nov 30 · 9:00 AM`, or `Nov 30, 2027`. */
  formatDue(iso: string, time?: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'No date';
    const clock = formatTime(time);
    const today = new Date().toISOString().slice(0, 10);
    const label = iso === today
      ? 'Today'
      : new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          ...(new Date(`${iso}T00:00:00`).getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' })
        });
    return clock ? `${label} · ${clock}` : label;
  }

  isOverdue(task: Task): boolean {
    return task.status !== 'completed' && task.dueDate < new Date().toISOString().slice(0, 10);
  }

  displayStatus(task: Task): TaskStatus {
    return this.isOverdue(task) ? 'overdue' : task.status;
  }

  async complete(id: string): Promise<void> {
    const task = this.tasks().find((item) => item.id === id);
    if (!task || !this.canActOnTask(task)) return;
    await this.changeStatus(id, 'completed');
  }

  async start(id: string): Promise<void> {
    const task = this.tasks().find((item) => item.id === id);
    if (!task || !this.canActOnTask(task)) return;
    await this.changeStatus(id, 'in_progress');
  }

  async create(): Promise<void> {
    if (!this.canManageTasks()) return;
    if (!this.form.title.trim() || !this.form.projectId || !this.form.assigneeId || !this.form.dueDate) {
      this.actionError.set('Complete every task field before creating it.');
      return;
    }
    if (!this.teamForSelectedProject().some(member => member.id === this.form.assigneeId)) {
      this.actionError.set('Choose a project member as the task assignee.');
      return;
    }
    if (this.form.dueDate && this.form.dueDate < this.tomorrow) {
      this.actionError.set('Pick a due date from tomorrow onward.');
      return;
    }
    const maxDue = this.selectedProjectDeadline();
    if (maxDue && this.form.dueDate > maxDue) {
      this.actionError.set('The due date cannot be later than the project deadline.');
      return;
    }

    // Fresh validation pass so stale/badly-escaped inputs never reach Firestore.
    try {
      const parsed = JSON.parse(JSON.stringify(this.form));
      if (typeof parsed.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) {
        this.actionError.set('Choose a valid due date.');
        return;
      }
      if (this.tomorrow && parsed.dueDate < this.tomorrow) {
        this.actionError.set('The due date cannot be today or earlier.');
        return;
      }
      if (maxDue && parsed.dueDate > maxDue) {
        this.actionError.set('The due date cannot be later than the project deadline.');
        return;
      }
    } catch {
      this.actionError.set('The due date was not understood by the form.');
      return;
    }

    this.actionError.set('');
    try {
      await this.data.addTask({
        title: this.form.title.trim(),
        projectId: this.form.projectId,
        assigneeId: this.form.assigneeId,
        status: 'todo',
        priority: this.form.priority,
        dueDate: this.form.dueDate,
        dueTime: this.form.dueTime || undefined,
      });
      this.form = { title: '', projectId: '', assigneeId: '', priority: 'medium', dueDate: '', dueTime: '' };
      this.showForm.set(false);
    } catch (error) {
      console.error('Task creation failed.', error);
      this.actionError.set('Task was not created. Check project access and Firestore rules.');
    }
  }

  private async changeStatus(id: string, status: TaskStatus): Promise<void> {
    this.actionError.set('');
    try {
      await this.data.updateTaskStatus(id, status);
    } catch (error) {
      console.error('Task status update failed.', error);
      this.actionError.set('Task status was not updated. Check your Firebase connection and permissions.');
    }
  }
}
