import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { ProjectStatus } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-adviser',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <div><p class="eyebrow">INSTRUCTOR / ADVISER</p><h1>Project review</h1><p>Monitor progress and leave guidance on projects assigned to you.</p></div>
      <div class="quick-links"><a routerLink="/contributions">View participation →</a><a routerLink="/files">Review project files →</a></div>
    </div>
    <div class="grid">
      @for (p of projects(); track p.id) {
        <div class="card">
          <div class="top">
            <span class="badge" [class]="p.status">{{ p.status }}</span>
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
                <option value="ongoing">On Going</option>
                <option value="on_hold">On Hold</option>
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
              <strong>Previous feedback</strong>
              @for (note of p.feedback; track $index) {
                <p>{{ note }}</p>
              }
            </div>
          }
        </div>
      }
      @empty {
        <div class="empty-state"><strong>No projects assigned</strong><span>When a project leader assigns you as adviser, its progress and feedback controls will appear here.</span></div>
      }
    </div>
  `,
  styles: [`
    .page-head { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.25rem; }
    .page-head h1 { margin: 0; font-size: clamp(1.5rem,2.4vw,1.9rem); color: var(--text,#0f172a); letter-spacing:-.04em; }
    .page-head p { margin: 0.3rem 0 0; color: var(--muted,#64748b); font-size:.82rem; }
    .eyebrow { color:#6268e8!important; font-size:.66rem!important; font-weight:800; letter-spacing:.14em; }
    .quick-links { display:flex; gap:.5rem; flex-wrap:wrap; }
    .quick-links a { border:1px solid var(--border,#e2e8f0); border-radius:9px; background:var(--surface,#fff); color:var(--text,#334155); padding:.58rem .7rem; font-size:.72rem; font-weight:700; text-decoration:none; white-space:nowrap; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
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
      background: #dcfce7;
      color: #166534;
      width: fit-content;
    }
    h3 { margin: 0.35rem 0 0.25rem; font-size: 1rem; color: #0f172a; }
    p { margin: 0; font-size: 0.85rem; color: #64748b; }
    .progress { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #64748b; }
    .review-controls { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; }
    .review-controls label { display:flex; flex-direction:column; gap:.35rem; color:#64748b; font-size:.75rem; font-weight:700; }
    .review-controls select { height:38px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#334155; }
    .feedback-history { border-top:1px solid #e2e8f0; padding-top:.7rem; }
    .feedback-history strong { font-size:.78rem; }
    .feedback-history p { margin:.4rem 0 0; padding:.55rem .65rem; border-radius:8px; background:#f8fafc; }
    .error { color:#dc2626; font-size:.76rem; }
    .empty-state { display:grid; gap:.35rem; grid-column:1/-1; padding:2.5rem 1rem; border:1px dashed var(--border,#e2e8f0); border-radius:14px; color:var(--muted,#64748b); text-align:center; font-size:.82rem; }
    .empty-state strong { color:var(--text,#0f172a); }
    .track { flex: 1; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; background: #3b82f6; border-radius: 999px; }
    textarea {
      width: 100%;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.6rem;
      font: inherit;
      min-height: 70px;
      resize: vertical;
    }
    button {
      align-self: flex-end;
      padding: 0.5rem 1rem;
      background: #2563eb;
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
  projects = computed(() => {
    const userId = this.auth.user()?.id;
    if (this.auth.hasRole('admin')) return this.data.projects();
    return this.data.projects().filter(project => project.adviserId === userId);
  });
  feedback: Record<string, string> = {};
  readonly feedbackError = signal('');

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
