import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../../core/services/data.service';
import { ProjectStatus, Task, TaskStatus } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { formatTime } from '../../core/utils/date-time';

@Component({
  selector: 'app-adviser',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <div><p class="eyebrow">INSTRUCTOR / ADVISER</p><h1>Project review</h1></div>
      <div class="quick-links">
        <a routerLink="/contributions" [queryParams]="projectFilter() ? { projectId: projectFilter() } : null">View participation →</a>
        <a routerLink="/files" [queryParams]="projectFilter() ? { projectId: projectFilter() } : null">Review project files →</a>
      </div>
    </div>
    @if (projectFilter() || taskFilter()) {
      <div class="context-filter">
        <span>{{ taskFilter() ? 'Showing the linked task in ' + projectTitle(projectFilter()) : 'Showing ' + projectTitle(projectFilter()) }}</span>
        <button type="button" (click)="clearContext()">Show all assigned projects</button>
      </div>
    }
    <div class="grid">
      @for (p of projects(); track p.id) {
        <div class="card">
          <div class="top">
            <span class="badge" [class]="p.status">{{ statusLabel(p.status) }}</span>
            <h3>{{ p.title }}</h3>
            <p>{{ p.description }}</p>
          </div>
          <div class="progress">
            <div class="track"><div class="fill" [style.width.%]="p.progress"></div></div>
            <span>{{ p.progress }}%</span>
          </div>
          <div class="review-controls">
            <label>Status
              <select [ngModel]="p.status" (ngModelChange)="updateStatus(p.id, $event)">
                <option value="ongoing">In progress</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <label>Progress
              <input type="range" min="0" max="100" [value]="p.progress" (change)="updateProgress(p.id, $event)" />
            </label>
          </div>
          <textarea [(ngModel)]="feedback[p.id]" placeholder="Write feedback for this project..."></textarea>
          <button type="button" (click)="submitFeedback(p.id)">Submit Feedback</button>
          @if (feedbackError()) { <small class="error">{{ feedbackError() }}</small> }
          @if (p.feedback?.length) {
            <div class="feedback-history">
              <strong>Previous project feedback</strong>
              @for (note of p.feedback; track $index) {
                <p>{{ note }}</p>
              }
            </div>
          }

          <section class="task-review">
            <header class="task-review-head">
              <h4>Task feedback</h4>
              <a routerLink="/tasks" [queryParams]="{ projectId: p.id }" class="task-review-link">All task reviews →</a>
            </header>
            <div class="task-review-body">
              @for (task of tasksFor(p.id); track task.id) {
                <article class="task-item">
                  <div class="task-top">
                    <div class="task-copy">
                      <strong>{{ task.title }}</strong>
                      <small>{{ assigneeName(task.assigneeId) }} · due {{ formatDate(task.dueDate, task.dueTime) }}</small>
                    </div>
                    <span class="status" [class]="task.status">{{ taskStatusLabel(task.status) }}</span>
                  </div>

                  @if (commentsFor(task.id).length) {
                    <ul class="task-notes">
                      @for (note of commentsFor(task.id); track note.id) {
                        <li><b>{{ note.authorName }}</b><span>{{ note.body }}</span></li>
                      }
                    </ul>
                  }

                  @if (taskOpen(task)) {
                    <div class="task-form">
                      <input
                        [(ngModel)]="taskFeedback[task.id]"
                        maxlength="2000"
                        placeholder="Feedback for {{ assigneeName(task.assigneeId) }}…"
                        [attr.aria-label]="'Task feedback for ' + task.title"
                      />
                      <button type="button" (click)="submitTaskFeedback(task.id)" [disabled]="savingTask() === task.id">
                        {{ savingTask() === task.id ? 'Saving…' : 'Send' }}
                      </button>
                    </div>
                  } @else {
                    <p class="task-closed">Feedback closed — past due date</p>
                  }
                </article>
              } @empty {
                <p class="task-empty">No tasks have been assigned in this project yet.</p>
              }
            </div>
            @if (taskError()) { <small class="error">{{ taskError() }}</small> }
          </section>
        </div>
      }
      @empty {
      }
    </div>
  `,
  styles: [`
    .page-head { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.25rem; }
    .page-head h1 { margin: 0; font-size: clamp(1.5rem,2.4vw,1.9rem); color: var(--text,var(--text)); letter-spacing:-.04em; }
    .page-head p { margin: 0.3rem 0 0; color: var(--muted,var(--muted)); font-size:.82rem; }
    .context-filter { display:flex; align-items:center; gap:.65rem; margin:-.5rem 0 1rem; padding:.65rem .8rem; border:1px solid var(--border); border-radius:8px; background:var(--surface-2); color:var(--text); font-size:.78rem; }
    .context-filter button { margin-left:auto; border:0; padding:0; background:transparent; color:var(--accent); font:inherit; font-weight:700; cursor:pointer; }
    .eyebrow { color:var(--accent)!important; font-size:.66rem!important; font-weight:800; letter-spacing:.14em; }
    .quick-links { display:flex; gap:.5rem; flex-wrap:wrap; }
    .quick-links a { border:1px solid var(--border,var(--border)); border-radius:9px; background:var(--surface,#fff); color:var(--text,var(--ink-soft)); padding:.58rem .7rem; font-size:.72rem; font-weight:700; text-decoration:none; white-space:nowrap; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      text-transform: capitalize;
      background: var(--surface-2);
      color: var(--moss);
      width: fit-content;
    }
    h3 { margin: 0.35rem 0 0.25rem; font-size: 1rem; color: var(--text); }
    p { margin: 0; font-size: 0.85rem; color: var(--muted); }
    .progress { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--muted); }
    .review-controls { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; }
    .review-controls label { display:flex; flex-direction:column; gap:.35rem; color:var(--muted); font-size:.75rem; font-weight:700; }
    .review-controls select { height:38px; border:1px solid var(--border); border-radius:8px; background: var(--surface); color:var(--ink-soft); }
    .task-review { display:grid; gap:.5rem; margin-top:.15rem; padding-top:.8rem; border-top:1px solid var(--border); }
    .task-review-head { display:flex; align-items:baseline; justify-content:space-between; gap:.5rem; }
    .task-review-head h4 { margin:0; font-family:var(--font-mono); font-size:.56rem; font-weight:500; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }
    .task-review-link { color:var(--accent); font-size:.7rem; font-weight:600; text-decoration:none; white-space:nowrap; }
    .task-review-body { display:grid; gap:.4rem; max-height:19rem; overflow-y:auto; padding-right:.15rem; }
    .task-item { display:grid; gap:.35rem; padding:.55rem .6rem; border:1px solid var(--border); border-radius:2px; background:var(--surface); }
    .task-top { display:flex; align-items:flex-start; justify-content:space-between; gap:.5rem; }
    .task-copy { display:grid; gap:.1rem; min-width:0; }
    .task-copy strong { font-size:.78rem; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .task-copy small { font-family:var(--font-mono); font-size:.52rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .task-notes { list-style:none; margin:0; padding:0; display:grid; gap:.25rem; }
    .task-notes li { display:grid; gap:.05rem; padding:.35rem .45rem; border-left:2px solid var(--accent); background:var(--surface-2); border-radius:0 2px 2px 0; }
    .task-notes b { font-family:var(--font-mono); font-size:.52rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
    .task-notes span { font-size:.75rem; line-height:1.45; color:var(--ink-soft); }
    .task-form { display:flex; gap:.4rem; }
    .task-form input { flex:1; min-width:0; height:34px; border:1px solid var(--border); border-radius:2px; background:var(--field); color:var(--text); padding:0 .55rem; font-size:.78rem; }
    .task-form button { flex:0 0 auto; border:1px solid transparent; border-radius:2px; background:var(--btn); color:#f7f1e1; padding:0 .7rem; font-size:.72rem; font-weight:600; cursor:pointer; }
    .task-form button:hover { background:var(--btn-hover); }
    .task-form button:disabled { opacity:.55; cursor:not-allowed; }
    .task-closed { margin:0; font-family:var(--font-mono); font-size:.54rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
    .task-empty { margin:0; font-size:.74rem; color:var(--muted); }
    .feedback-history { border-top:1px solid var(--border); padding-top:.7rem; }
    .feedback-history strong { font-size:.78rem; }
    .feedback-history p { margin:.4rem 0 0; padding:.55rem .65rem; border-radius:8px; background:var(--surface-2); }
    .error { color:var(--danger); font-size:.76rem; }
    .empty-state { display:grid; gap:.35rem; grid-column:1/-1; padding:2.5rem 1rem; border:1px dashed var(--border,var(--border)); border-radius:14px; color:var(--muted,var(--muted)); text-align:center; font-size:.82rem; }
    .empty-state strong { color:var(--text,var(--text)); }
    .track { flex: 1; height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; background: var(--accent); border-radius: 999px; }
    textarea {
      width: 100%;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      padding: 0.6rem;
      font: inherit;
      min-height: 70px;
      resize: vertical;
    }
    button {
      align-self: flex-end;
      padding: 0.5rem 1rem;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    @media(max-width:700px) { .page-head { flex-direction:column; } }
  `]
})
export class AdviserComponent {
  private readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly projectFilter = signal('');
  readonly taskFilter = signal('');
  projects = computed(() => {
    const userId = this.auth.user()?.id;
    const assigned = this.auth.hasRole('admin')
      ? this.data.projects()
      : this.data.projects().filter(project => project.adviserId === userId);
    return assigned.filter(project => !this.projectFilter() || project.id === this.projectFilter());
  });
  feedback: Record<string, string> = {};
  readonly feedbackError = signal('');

  readonly savingTask = signal<string | null>(null);
  readonly taskError = signal('');
  taskFeedback: Record<string, string> = {};

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.projectFilter.set(params.get('projectId') ?? '');
      this.taskFilter.set(params.get('taskId') ?? '');
    });
  }

  projectTitle(projectId: string): string {
    return this.data.projects().find(project => project.id === projectId)?.title ?? 'selected project';
  }

  clearContext(): void {
    this.projectFilter.set('');
    this.taskFilter.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { projectId: null, taskId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  statusLabel(status: ProjectStatus): string {
    if (status === 'on_hold') return 'On hold';
    if (status === 'ongoing') return 'In progress';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  /** Tasks belonging to one project, soonest deadline first. */
  tasksFor(projectId: string): Task[] {
    return this.data.tasks()
      .filter(task => task.projectId === projectId && (!this.taskFilter() || task.id === this.taskFilter()))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  commentsFor(taskId: string) {
    return this.data.taskComments().filter(comment => comment.taskId === taskId);
  }

  assigneeName(id: string): string {
    return this.data.team().find(member => member.id === id)?.name ?? 'Unassigned';
  }

  taskStatusLabel(status: TaskStatus): string {
    if (status === 'in_progress') return 'In progress';
    if (status === 'todo') return 'To do';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  /** Matches the task review rule: comment windows close once the due date passes. */
  taskOpen(task: Task): boolean {
    return task.dueDate >= new Date().toISOString().slice(0, 10);
  }

  formatDate(value: string, time?: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'no date';
    const label = new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const clock = formatTime(time);
    return clock ? `${label} · ${clock}` : label;
  }

  async submitTaskFeedback(taskId: string): Promise<void> {
    const body = (this.taskFeedback[taskId] ?? '').trim();
    if (!body) return;
    this.savingTask.set(taskId);
    this.taskError.set('');
    try {
      await this.data.addTaskComment(taskId, body);
      this.taskFeedback[taskId] = '';
    } catch (error) {
      console.error('Task feedback could not be saved.', error);
      this.taskError.set(
        error instanceof Error ? error.message : 'Task feedback was not saved. Check project access and Firestore rules.'
      );
    } finally {
      this.savingTask.set(null);
    }
  }

  async submitFeedback(projectId: string): Promise<void> {
    const message = this.feedback[projectId]?.trim();
    if (!message) return;
    const project = this.projects().find(item => item.id === projectId);
    if (!project) return;
    this.feedbackError.set('');
    try {
      await this.data.addProjectFeedback(projectId, message);
      this.feedback[projectId] = '';
    } catch (error) {
      console.error('Adviser feedback could not be saved.', error);
      this.feedbackError.set('Feedback was not saved. Check project access and Firestore rules.');
    }
  }

  async updateStatus(projectId: string, status: ProjectStatus): Promise<void> {
    this.feedbackError.set('');
    try {
      await this.data.updateProject(projectId, { status });
    } catch (error) {
      console.error('Adviser could not update project status.', error);
      this.feedbackError.set('Project status update failed.');
    }
  }

  async updateProgress(projectId: string, event: Event): Promise<void> {
    const progress = Number((event.target as HTMLInputElement).value);
    this.feedbackError.set('');
    try {
      await this.data.updateProject(projectId, { progress });
    } catch (error) {
      console.error('Adviser could not update project progress.', error);
      this.feedbackError.set('Project progress update failed.');
    }
  }
}
