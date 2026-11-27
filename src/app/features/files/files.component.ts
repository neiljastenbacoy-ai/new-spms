import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { DataService, MAX_SHARED_FILE_BYTES } from '../../core/services/data.service';
import { FileItem } from '../../core/models/models';

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-head">
      <h1>File Management</h1>
    </div>
    <label class="file-search">Search files
      <input type="search" [value]="search()" (input)="updateSearch($event)"
        placeholder="Search file names or projects" aria-label="Search shared files" />
    </label>
    <label class="project-picker">{{ canUpload() ? 'Upload to project' : 'Filter by project' }}
      <select [value]="selectedProjectId()" (change)="selectProject($event)" [disabled]="isUploading()">
        <option value="">{{ canUpload() ? 'Select a project for uploads' : 'All assigned projects' }}</option>
        @for (project of data.projects(); track project.id) {
          <option [value]="project.id">{{ project.title }}</option>
        }
      </select>
    </label>
    @if (canUpload()) {
      <input #fileInput type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" (change)="onFilesSelected($event)" />
      <div class="upload-zone" [class.disabled]="isUploading() || !selectedProjectId()" [class.uploading]="isUploading()" (click)="!isUploading() && selectedProjectId() && fileInput.click()" (dragover)="onDragOver($event)" (drop)="onDrop($event)">
        <div class="upload-icon">⇧</div>
        <strong>{{ isUploading() ? 'Uploading files...' : 'Upload files' }}</strong>
        <span>{{ selectedProjectId() ? 'PDF, images, documents, and spreadsheets · up to 500 KiB per file' : 'Select a project above to enable uploads' }}</span>
        <button type="button" class="btn" [disabled]="isUploading() || !selectedProjectId()" (click)="fileInput.click(); $event.stopPropagation()">Choose files</button>
      </div>
    }
    @if (message()) { <div class="message" [class.error]="messageIsError()">{{ message() }}</div> }
    @if (visibleLocalFiles().length) {
      <section class="local-files">
        <h2>Files saved in this browser</h2>
        @for (file of visibleLocalFiles(); track file.id) {
          <div class="file">
            <span class="ico">{{ fileIcon(file.type) }}</span>
            <div>
              <strong>{{ file.name }}</strong>
              <span>{{ projectTitle(file.projectId) }} · Uploaded by {{ uploaderName(file.uploadedBy) }} · {{ formatSize(file.size) }}</span>
            </div>
            <span class="date">{{ formatDate(file.uploadedAt) }}</span>
            <div class="file-actions">
              <button type="button" (click)="downloadLocal(file)">Download</button>
              @if (canUpload()) {
                <button type="button" [disabled]="isUploading() || file.size > maxSharedFileBytes" (click)="shareLocalFile(file)">Share with project</button>
              }
              <button type="button" class="remove" [disabled]="isUploading()" (click)="removeLocal(file.id)">Remove local copy</button>
            </div>
          </div>
        }
      </section>
    }
    <div class="file-list">
      @for (file of visibleFiles(); track file.id) {
      <div class="file">
        <span class="ico">{{ fileIcon(file.type) }}</span>
        <div>
          <strong>{{ file.name }}</strong>
          <span>{{ projectTitle(file.projectId) }} · Uploaded by {{ uploaderName(file.uploadedBy) }} · {{ formatSize(file.size) }}</span>
        </div>
        <span class="date">{{ formatDate(file.uploadedAt) }}</span>
        <div class="file-actions">
          <button type="button" (click)="download(file)">Download</button>
          @if (canRemove(file)) {
            <button type="button" class="remove" (click)="remove(file.id)">Remove</button>
          }
        </div>
      </div>
      } @empty {
        <div class="empty-state">No shared files are available for this project yet.</div>
      }
    </div>
  `,
  styles: [`
    .page-head { margin-bottom: 1.25rem; }
    .page-head h1 { margin: 0; font-size: 1.5rem; color: var(--text); }
    .page-head p { margin: 0.25rem 0 0; color: var(--muted); }
    .file-search { display:grid; gap:.35rem; max-width:440px; margin-bottom:.75rem; color:var(--ink-soft); font-size:.78rem; font-weight:600; }
    .file-search input { width:100%; min-height:40px; padding:.5rem .7rem; border:1px solid var(--border); border-radius:8px; background:var(--field); color:var(--text); font:inherit; }
    .project-picker { display:flex; flex-direction:column; gap:.35rem; max-width:440px; margin-bottom:.75rem; color:var(--ink-soft); font-size:.8rem; font-weight:600; }
    .project-picker select { height:40px; border:1px solid var(--line-strong); border-radius:9px; background: var(--surface); color:var(--ink-soft); padding:.45rem .7rem; font:inherit; }
    .local-files { display:grid; gap:.55rem; margin-bottom:1rem; }
    .local-files h2 { margin:0; color:var(--ink-soft); font-size:.92rem; }
    .local-files > p { margin:0 0 .25rem; color:var(--muted); font-size:.78rem; }
    .upload-zone {
      border: 2px dashed var(--line-strong);
      border-radius: 16px;
      padding: 2.5rem;
      text-align: center;
      background: var(--surface-2);
      margin-bottom: 1.25rem;
      color: var(--muted);
      cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    .upload-zone:hover { border-color:#60a5fa; background:#eff6ff; }
    .upload-zone.disabled { opacity:.65; cursor:not-allowed; }
    .upload-zone.uploading { cursor:wait; }
    .upload-icon { width:44px; height:44px; display:grid; place-items:center; margin:0 auto .65rem; border-radius:50%; background:var(--surface-2); color:var(--accent); font-size:1.35rem; }
    .upload-zone strong { display:block; color:var(--ink-soft); }
    .upload-zone > span { display:block; margin-top:.25rem; font-size:.78rem; }
    .message { margin:-.75rem 0 .75rem; padding:.65rem .8rem; background:var(--surface-2); color:var(--moss); border-radius:8px; font-size:.82rem; }
    .message.error { background:var(--danger-soft); color:var(--danger); }
    .btn {
      margin-top: 0.75rem;
      padding: 0.55rem 1.1rem;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:disabled { opacity:.6; cursor:wait; }
    .file-list { display: flex; flex-direction: column; gap: 0.55rem; }
    .empty-state { padding:2rem 1rem; border:1px dashed var(--border,var(--border)); border-radius:14px; color:var(--muted,var(--muted)); text-align:center; font-size:.82rem; }
    .file {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.9rem 1.15rem;
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 0.85rem;
      align-items: center;
    }
    .ico { font-size: 1.4rem; }
    .file strong { display: block; color: var(--text); font-size: 0.9rem; }
    .file span { font-size: 0.8rem; color: var(--muted); }
    .date { font-size: 0.8rem; color: var(--muted); }
    .file-actions { display:flex; gap:.4rem; }
    .file-actions button { border:1px solid var(--border); border-radius:8px; background: var(--surface); color:var(--ink-soft); padding:.38rem .62rem; font-size:.72rem; cursor:pointer; }
    .file-actions button:disabled { opacity:.5; cursor:not-allowed; }
    .file-actions .remove { color:var(--danger); border-color:var(--danger-soft); }
    @media (max-width:700px) { .file { grid-template-columns:auto 1fr auto; } .file-actions { grid-column:2/-1; } }
  `]
})
export class FilesComponent {
  readonly maxSharedFileBytes = MAX_SHARED_FILE_BYTES;
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly selectedProjectId = signal('');
  readonly isUploading = signal(false);
  readonly search = signal('');

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.selectedProjectId.set(params.get('projectId') ?? '');
      this.search.set(params.get('q') ?? '');
    });
    effect(() => {
      const projects = this.data.projects();
      if (projects.length === 1 && !this.selectedProjectId()) {
        this.selectedProjectId.set(projects[0].id);
      }
    });
  }

  canUpload(): boolean {
    return this.auth.hasRole('student', 'project_leader');
  }

  canRemove(file: FileItem): boolean {
    return this.auth.hasRole('project_leader') || file.uploadedBy === this.auth.user()?.id;
  }

  uploaderName(userId: string): string {
    return this.data.team().find(member => member.id === userId)?.name
      ?? (userId === this.auth.user()?.id ? 'you' : 'Unknown member');
  }

  visibleFiles(): FileItem[] {
    const projectId = this.selectedProjectId();
    const query = this.search().trim().toLowerCase();
    return this.data.files().filter(file =>
      (!projectId || file.projectId === projectId)
      && (!query || file.name.toLowerCase().includes(query) || this.projectTitle(file.projectId).toLowerCase().includes(query))
    );
  }

  visibleLocalFiles(): FileItem[] {
    const projectId = this.selectedProjectId();
    const query = this.search().trim().toLowerCase();
    return this.data.localFiles().filter(file =>
      (!projectId || file.projectId === projectId)
      && (!query || file.name.toLowerCase().includes(query) || this.projectTitle(file.projectId).toLowerCase().includes(query))
    );
  }

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  selectProject(event: Event): void {
    this.selectedProjectId.set((event.target as HTMLSelectElement).value);
    this.message.set('');
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.uploadFiles(event.dataTransfer?.files);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFiles(input.files);
    input.value = '';
  }

  private async uploadFiles(files: FileList | null | undefined): Promise<void> {
    if (this.isUploading() || !files?.length) return;
    const user = this.auth.user();
    const project = this.data.projects().find(item => item.id === this.selectedProjectId());
    if (!user) {
      this.messageIsError.set(true);
      this.message.set('Sign in before uploading project files.');
      return;
    }
    if (!project) {
      this.messageIsError.set(true);
      this.message.set('Select a project above before uploading files.');
      return;
    }

    const acceptedTypes = new Set([
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'text/plain'
    ]);
    const selected = Array.from(files);
    const invalid = selected.find(file => !acceptedTypes.has(file.type) || file.size > this.maxSharedFileBytes);
    if (invalid) {
      this.messageIsError.set(true);
      this.message.set(`${invalid.name} is not an allowed file type or exceeds 500 KiB.`);
      return;
    }

    this.isUploading.set(true);
    this.message.set('');
    let uploaded = 0;
    try {
      for (const file of selected) {
        await this.data.uploadFile(file, project.id, user.id);
        uploaded++;
      }
      this.messageIsError.set(false);
      this.message.set(`${selected.length} file${selected.length === 1 ? '' : 's'} uploaded and shared with project members.`);
    } catch (error) {
      console.error('File upload failed.', error);
      this.messageIsError.set(true);
      this.message.set(uploaded
        ? `${uploaded} of ${selected.length} files were shared. The remaining files failed.`
        : this.uploadErrorMessage(error));
    } finally {
      this.isUploading.set(false);
    }
  }

  private uploadErrorMessage(error: unknown): string {
    const details = typeof error === 'object' && error !== null
      ? error as { name?: unknown; code?: unknown; message?: unknown }
      : {};
    const code = String(details.code ?? '');
    const message = String(details.message ?? '');
    if (message.includes('500 KiB')) return message;
    if (code === 'permission-denied') {
      return 'Firestore denied this upload. Confirm the Firestore rules are deployed and that you can upload to this project.';
    }
    if (code === 'resource-exhausted' || code === 'unavailable') {
      return 'Firestore could not store the file. Check project quota and your network connection.';
    }
    return `Could not upload the file${details.name ? ` (${String(details.name)})` : ''}. Check the Firestore connection and try again.`;
  }

  projectTitle(projectId: string): string {
    return this.data.projects().find(project => project.id === projectId)?.title ?? 'General';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  fileIcon(type: string): string {
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('sheet') || type.includes('excel')) return 'XLS';
    if (type.includes('word') || type.includes('document')) return 'DOC';
    return 'FILE';
  }

  async download(file: FileItem): Promise<void> {
    try {
      const blob = await this.data.downloadFile(file);
      this.startDownload(blob, file.name);
      this.messageIsError.set(false);
      this.message.set('Download started.');
    } catch (error) {
      console.error('File download failed.', error);
      this.messageIsError.set(true);
      this.message.set('Could not download this shared file. Check your project access and Firestore connection.');
    }
  }

  async shareLocalFile(file: FileItem): Promise<void> {
    this.isUploading.set(true);
    this.message.set('');
    try {
      await this.data.shareLocalFile(file.id);
      this.messageIsError.set(false);
      this.message.set(`${file.name} is now shared with project members.`);
    } catch (error) {
      console.error('Sharing a previous local file failed.', error);
      this.messageIsError.set(true);
      const errorMessage = error instanceof Error ? error.message : '';
      this.message.set(errorMessage.startsWith('File shared with the project')
        ? errorMessage
        : this.uploadErrorMessage(error));
    } finally {
      this.isUploading.set(false);
    }
  }

  async downloadLocal(file: FileItem): Promise<void> {
    try {
      const blob = await this.data.downloadLocalFile(file.id);
      this.startDownload(blob, file.name);
      this.messageIsError.set(false);
      this.message.set('Download started.');
    } catch (error) {
      console.error('Local file download failed.', error);
      this.messageIsError.set(true);
      this.message.set('Could not read this file from browser storage.');
    }
  }

  async removeLocal(fileId: string): Promise<void> {
    if (!window.confirm('Remove this browser-only file?')) return;
    try {
      await this.data.removeLocalFile(fileId);
      this.messageIsError.set(false);
      this.message.set('Local file removed.');
    } catch (error) {
      console.error('Local file removal failed.', error);
      this.messageIsError.set(true);
      this.message.set('Could not remove this browser-only file.');
    }
  }

  private startDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async remove(fileId: string): Promise<void> {
    if (window.confirm('Remove this file?')) {
      try {
        await this.data.removeFile(fileId);
        this.messageIsError.set(false);
        this.message.set('File removed.');
      } catch (error) {
        console.error('File removal failed.', error);
        this.messageIsError.set(true);
        this.message.set('Could not remove this file. Check your project permissions.');
      }
    }
  }
}
