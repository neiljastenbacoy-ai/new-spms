import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { Task, TaskStatus, User } from '../../core/models/models';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ auth.hasRole('student') ? 'My tasks' : 'Project tasks' }}</h1>
        <p>{{ auth.hasRole('student') ? 'Work through assigned tasks, update their status, and keep due dates in view.' : 'Create assignments, set due dates, and follow progress across your projects.' }}</p>
      </div>
      @if (canManageTasks()) {
        <button class="add-btn" type="button" (click)="openCreate()">
          + New Task
        </button>
      }
    </div>

    <div class="toolbar">
      <input type="search" [(ngModel)]="search" placeholder="Search tasks..." />
      <select [(ngModel)]="statusFilter">
        <option value="all">All statuses</option>
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="overdue">Overdue</option>
      </select>
    </div>
    @if (actionError()) { <div class="action-error">{{ actionError() }}</div> }

    @if (showForm()) {
      <div class="modal-backdrop" (click)="showForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Create Task</h2>
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
          /></label>
          <div class="modal-actions">
            <button type="button" class="cancel" (click)="showForm.set(false)">
              Cancel
            </button>
            <button type="button" class="save" (click)="create()">
              Create Task
            </button>
          </div>
        </div>
      </div>
    }

    <div class="task-table">
      <div class="thead">
        <span>Task</span>
        <span>Project</span>
        <span>Priority</span>
        <span>Due</span>
        <span>Status</span>
        <span></span>
      </div>
      @for (t of filteredTasks(); track t.id) {
        <div class="trow">
          <span class="title">{{ t.title }}</span>
          <span class="muted">{{ projectTitle(t.projectId) }}</span>
          <span class="prio" [class]="t.priority">{{ t.priority }}</span>
          <span class="muted">{{ t.dueDate }}</span>
          <span class="status" [class]="displayStatus(t)">{{
            statusLabel(displayStatus(t))
          }}</span>
          <div class="actions">
            @if (t.status !== 'completed') {
              @if (canActOnTask(t)) {
                @if (t.status === 'todo' || isOverdue(t)) {
                  <button type="button" (click)="start(t.id)">Start</button>
                }
                @if (t.status === 'in_progress') {
                  <button type="button" (click)="complete(t.id)">
                    Complete
                  </button>
                }
              }
            }
          </div>
        </div>
      }
      @empty {
        <div class="empty-row">{{ search || statusFilter !== 'all' ? 'No tasks match the current filters.' : 'No tasks are assigned to your projects yet.' }}</div>
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
        color: #0f172a;
      }
      .page-head p {
        margin: 0.25rem 0 0;
        color: #64748b;
        font-size: 0.9rem;
      }
      .add-btn,
      .save {
        border: 0;
        border-radius: 9px;
        background: #2563eb;
        color: #fff;
        padding: 0.55rem 0.85rem;
        font-weight: 700;
        cursor: pointer;
      }
      .action-error {
        margin-bottom: 0.75rem;
        padding: 0.65rem 0.8rem;
        border-radius: 8px;
        background: #fef2f2;
        color: #b91c1c;
        font-size: 0.8rem;
      }
      .toolbar {
        display: flex;
        gap: 0.65rem;
        margin-bottom: 0.75rem;
      }
      .toolbar input,
      .toolbar select {
        height: 40px;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        background: #fff;
        color: #334155;
        padding: 0.5rem 0.75rem;
      }
      .toolbar input {
        flex: 1;
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
        background: #fff;
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
        color: #334155;
        font-size: 0.82rem;
        font-weight: 700;
      }
      .modal input,
      .modal select {
        height: 42px;
        border: 1px solid #e2e8f0;
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
        border: 1px solid #e2e8f0;
        background: #fff;
        color: #334155;
      }
      .task-table {
        background: #fff;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        overflow: hidden;
      }
      .thead,
      .trow {
        display: grid;
        grid-template-columns: 2fr 1.4fr 0.8fr 1fr 1fr 0.8fr;
        gap: 0.75rem;
        padding: 0.85rem 1.25rem;
        align-items: center;
        font-size: 0.875rem;
      }
      .thead {
        background: #f8fafc;
        font-weight: 600;
        color: #64748b;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .trow {
        border-top: 1px solid #f1f5f9;
      }
      .title {
        font-weight: 600;
        color: #0f172a;
      }
      .muted {
        color: #64748b;
      }
      .prio {
        text-transform: capitalize;
        font-weight: 600;
        font-size: 0.8rem;
      }
      .prio.high {
        color: #b91c1c;
      }
      .prio.medium {
        color: #c2410c;
      }
      .prio.low {
        color: #64748b;
      }
      .status {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        width: fit-content;
      }
      .status.todo {
        background: #f1f5f9;
        color: #475569;
      }
      .status.in_progress {
        background: #dbeafe;
        color: #1d4ed8;
      }
      .status.completed {
        background: #dcfce7;
        color: #166534;
      }
      .status.overdue {
        background: #fee2e2;
        color: #991b1b;
      }
      .empty-row { padding:2.5rem 1rem; color:#64748b; text-align:center; font-size:.82rem; }
      .actions button {
        padding: 0.35rem 0.75rem;
        border-radius: 8px;
        border: none;
        background: #2563eb;
        color: #fff;
        font-size: 0.8rem;
        cursor: pointer;
      }
    `,
  ],
})
export class TasksComponent {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  tasks = this.data.tasks;
  showForm = signal(false);
  search = '';
  statusFilter = 'all';
  readonly actionError = signal('');
  form = {
    title: '',
    projectId: '',
    assigneeId: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
  };

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

    return roleVisibleTasks.filter((task) => {
      const overdue = task.status === 'overdue' ||
        (task.status !== 'completed' && task.dueDate < today);
      const matchesStatus = this.statusFilter === 'all' ||
        (this.statusFilter === 'overdue' ? overdue : task.status === this.statusFilter);
      const matchesQuery =
        !query ||
        task.title.toLowerCase().includes(query) ||
        this.projectTitle(task.projectId).toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }

  canManageTasks(): boolean {
    return this.auth.hasRole('project_leader', 'admin');
  }

  openCreate(): void {
    this.actionError.set('');
    this.form = { title: '', projectId: '', assigneeId: '', priority: 'medium', dueDate: '' };
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
    if (this.auth.hasRole('admin')) return true;
    if (this.auth.hasRole('project_leader')) {
      return (
        this.data.projects().find((project) => project.id === task.projectId)
          ?.leaderId === user.id
      );
    }
    return task.assigneeId === user.id;
  }

  projectTitle(id: string): string {
    return this.data.projects().find((p) => p.id === id)?.title ?? '—';
  }

  statusLabel(s: TaskStatus): string {
    if (s === 'in_progress') return 'In Progress';
    if (s === 'todo') return 'To Do';
    if (s === 'overdue') return 'Overdue';
    return s.charAt(0).toUpperCase() + s.slice(1);
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

    this.actionError.set('');
    try {
      await this.data.addTask({
        title: this.form.title.trim(),
        projectId: this.form.projectId,
        assigneeId: this.form.assigneeId,
        status: 'todo',
        priority: this.form.priority,
        dueDate: this.form.dueDate,
      });
      this.form = { title: '', projectId: '', assigneeId: '', priority: 'medium', dueDate: '' };
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
