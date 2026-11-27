import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { User } from '../../core/models/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-page">
      <div class="page-head">
        <div>
          <span class="eyebrow">Account</span>
          <h1>Profile settings</h1>
        </div>
      </div>

      <div class="profile-layout">
        <aside class="profile-card">
          <div class="photo-wrap">
            @if (photoPreview()) {
              <img [src]="photoPreview()" alt="Profile photo" />
            } @else {
              <div class="photo-fallback">{{ initials() }}</div>
            }
            <label class="photo-edit" title="Change profile photo">
              <input type="file" accept="image/png,image/jpeg,image/webp" [disabled]="photoUploading()" (change)="onPhotoSelected($event)" />
              <span>✎</span>
            </label>
          </div>

          <h2>{{ form.name || 'Your Name' }}</h2>
          <p class="role">{{ roleLabel() }}</p>
          @if (form.studentId) {
            <span class="student-id">{{ form.studentId }}</span>
          }

          <div class="photo-actions">
            <label class="upload-button">
              <input type="file" accept="image/png,image/jpeg,image/webp" [disabled]="photoUploading()" (change)="onPhotoSelected($event)" />
              {{ photoUploading() ? 'Uploading…' : 'Upload photo' }}
            </label>
            @if (photoPreview()) {
              <button type="button" class="remove-button" [disabled]="photoUploading()" (click)="removePhoto()">Remove</button>
            }
          </div>

          @if (photoError()) {
            <div class="photo-error">{{ photoError() }}</div>
          }
          @if (photoUploaded()) {
            <div class="photo-success">Profile photo uploaded.</div>
          }
          <small>PNG, JPG or WebP · 3 MB maximum. Photos upload when selected.</small>
        </aside>

        <section class="settings-card">
          <div class="settings-head">
            <div>
              <h2>Personal information</h2>
            </div>
            @if (saved()) {
              <span class="saved">✓ Saved</span>
            }
          </div>

          <form (ngSubmit)="saveProfile()" class="profile-form">
            <div class="field-grid">
              <label>
                <span>Full name</span>
                <input [(ngModel)]="form.name" name="name" autocomplete="name" required />
              </label>
              <label>
                <span>Email address</span>
                <input type="email" [(ngModel)]="form.email" name="email" autocomplete="email" required />
              </label>
              @if (auth.hasRole('student')) {
                <label>
                  <span>Student ID</span>
                  <input [(ngModel)]="form.studentId" name="studentId" placeholder="2021-00123" />
                </label>
              }
              <label>
                <span>Department</span>
                <input [(ngModel)]="form.department" name="department" placeholder="Department or office" />
              </label>
              <label>
                <span>Phone number</span>
                <input type="tel" [(ngModel)]="form.phone" name="phone" autocomplete="tel" placeholder="+63 900 000 0000" />
              </label>
              <label class="full">
                <span>Bio</span>
                <textarea [(ngModel)]="form.bio" name="bio" rows="4" placeholder="Write a short profile bio"></textarea>
              </label>
            </div>

            <div class="form-divider"></div>
            <div class="preference-row">
              <div>
                <strong>Appearance</strong>
                <span>Choose the interface color theme</span>
              </div>
              <div class="theme-options">
                <button type="button" [class.active]="!theme.isDark()" (click)="theme.setTheme('light')">
                  <span class="theme-preview light-preview">☀</span>
                  Light
                </button>
                <button type="button" [class.active]="theme.isDark()" (click)="theme.setTheme('dark')">
                  <span class="theme-preview dark-preview">☾</span>
                  Dark
                </button>
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="secondary" (click)="resetForm()">Reset</button>
              <button type="submit" class="primary" [disabled]="saving() || photoUploading()">
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .profile-page { max-width:1180px; margin:0 auto; }
    .page-head { margin-bottom:1.35rem; }
    .eyebrow { color:var(--accent); font-size:.72rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    .page-head h1 { margin:.28rem 0 .25rem; font-size:1.75rem; letter-spacing:-.035em; color:var(--text); }
    .page-head p { margin:0; color:var(--muted); font-size:.9rem; }
    .profile-layout { display:grid; grid-template-columns:280px minmax(0,1fr); gap:1rem; align-items:start; }
    .profile-card, .settings-card {
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:18px;
      box-shadow:0 3px 14px rgba(15,23,42,.035);
    }
    .profile-card { padding:1.5rem 1.25rem; text-align:center; }
    .photo-wrap { position:relative; width:132px; height:132px; margin:0 auto 1rem; }
    .photo-wrap img, .photo-fallback {
      width:132px;
      height:132px;
      border-radius:50%;
      object-fit:cover;
      border:5px solid var(--surface);
      box-shadow:0 0 0 1px var(--border), 0 12px 28px rgba(15,23,42,.12);
    }
    .photo-fallback {
      display:grid;
      place-items:center;
      background:linear-gradient(135deg,var(--accent),var(--accent));
      color:#fff;
      font-size:2.25rem;
      font-weight:800;
      letter-spacing:.02em;
    }
    .photo-edit {
      position:absolute;
      right:2px;
      bottom:8px;
      width:36px;
      height:36px;
      border:3px solid var(--surface);
      border-radius:50%;
      background:var(--accent);
      color:#fff;
      display:grid;
      place-items:center;
      cursor:pointer;
      box-shadow:0 5px 12px rgba(20,51,42,.28);
    }
    .photo-edit input, .upload-button input { display:none; }
    .profile-card h2 { margin:.75rem 0 .15rem; font-size:1.05rem; color:var(--text); }
    .role { margin:0; color:var(--muted); font-size:.82rem; }
    .student-id { display:inline-block; margin-top:.55rem; padding:.25rem .55rem; border-radius:999px; background:var(--surface-soft); color:var(--muted); font-size:.72rem; }
    .photo-actions { display:flex; justify-content:center; gap:.5rem; margin-top:1.15rem; }
    .upload-button, .remove-button {
      min-height:38px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border-radius:9px;
      padding:.55rem .75rem;
      font-size:.78rem;
      font-weight:700;
      cursor:pointer;
    }
    .upload-button { background:var(--surface-2); color:var(--accent); border:1px solid var(--accent); }
    .remove-button { background:var(--surface); color:var(--danger); border:1px solid var(--danger-soft); }
    .profile-card small { display:block; margin-top:.75rem; color:var(--muted); font-size:.68rem; }
    .photo-error { margin-top:.65rem; color:var(--danger); font-size:.72rem; }
    .photo-success { margin-top:.65rem; color:var(--moss); font-size:.72rem; font-weight:700; }
    .settings-card { padding:1.35rem 1.5rem 1.25rem; }
    .settings-head { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:1.1rem; border-bottom:1px solid var(--border); }
    .settings-head h2 { margin:0 0 .25rem; font-size:1.05rem; color:var(--text); }
    .settings-head p { margin:0; color:var(--muted); font-size:.82rem; }
    .saved { color:var(--moss); background:var(--surface-2); border-radius:999px; padding:.35rem .65rem; font-size:.72rem; font-weight:800; }
    .profile-form { padding-top:1.15rem; }
    .field-grid { display:grid; grid-template-columns:1fr 1fr; gap:.85rem 1rem; }
    .field-grid label { display:flex; flex-direction:column; gap:.38rem; color:var(--text); font-size:.78rem; font-weight:700; }
    .field-grid label.full { grid-column:1/-1; }
    .field-grid input, .field-grid textarea {
      width:100%;
      border:1px solid var(--border);
      border-radius:9px;
      background:var(--input);
      color:var(--text);
      padding:.72rem .82rem;
      font:inherit;
      font-weight:500;
      resize:vertical;
    }
    .field-grid input { height:44px; }
    .field-grid input:focus, .field-grid textarea:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(176,74,44,.16); }
    .form-divider { height:1px; background:var(--border); margin:1.15rem 0; }
    .preference-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
    .preference-row > div:first-child { display:flex; flex-direction:column; gap:.2rem; }
    .preference-row strong { color:var(--text); font-size:.82rem; }
    .preference-row > div:first-child span { color:var(--muted); font-size:.75rem; }
    .theme-options { display:flex; gap:.5rem; }
    .theme-options button {
      min-width:92px;
      border:1px solid var(--border);
      border-radius:10px;
      background:var(--surface);
      color:var(--muted);
      padding:.45rem;
      display:flex;
      align-items:center;
      gap:.45rem;
      font-size:.76rem;
      cursor:pointer;
    }
    .theme-options button.active { border-color:var(--accent); color:var(--accent); background:rgba(176,74,44,.08); }
    .theme-preview { width:30px; height:30px; display:grid; place-items:center; border-radius:7px; }
    .light-preview { background:var(--surface-2); color:var(--ochre); border:1px solid var(--border); }
    .dark-preview { background:var(--text); color:var(--surface-2); }
    .form-actions { display:flex; justify-content:flex-end; gap:.55rem; margin-top:1.35rem; }
    .form-actions button { height:42px; border-radius:9px; padding:.55rem .9rem; font-weight:800; font-size:.78rem; cursor:pointer; }
    .secondary { border:1px solid var(--border); background:var(--surface); color:var(--text); }
    .primary { border:0; background:linear-gradient(135deg,var(--accent),var(--accent)); color:#fff; box-shadow:0 8px 18px rgba(91,103,241,.18); }
    .primary:disabled { opacity:.7; cursor:not-allowed; }
    @media (max-width:850px) {
      .profile-layout { grid-template-columns:1fr; }
      .profile-card { max-width:none; }
    }
    @media (max-width:600px) {
      .field-grid { grid-template-columns:1fr; }
      .field-grid label.full { grid-column:auto; }
      .preference-row { align-items:flex-start; flex-direction:column; }
      .theme-options { width:100%; }
      .theme-options button { flex:1; min-width:0; }
      .settings-card { padding:1.1rem; }
    }
  `]
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly photoPreview = signal<string>('');
  readonly photoError = signal('');
  readonly photoUploading = signal(false);
  readonly photoUploaded = signal(false);
  readonly saved = signal(false);
  readonly saving = signal(false);

  form: Pick<User, 'name' | 'email' | 'studentId' | 'department' | 'phone' | 'bio'> = {
    name: '',
    email: '',
    studentId: '',
    department: '',
    phone: '',
    bio: ''
  };

  constructor() {
    this.resetForm();
  }

  initials(): string {
    const name = this.auth.user()?.name ?? 'User';
    return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  }

  roleLabel(): string {
    const role = this.auth.user()?.role;
    if (role === 'project_leader') return 'Project Leader';
    if (role === 'adviser') return 'Adviser';
    if (role === 'admin') return 'Administrator';
    return 'Student';
  }

  resetForm(): void {
    const user = this.auth.user();
    if (!user) return;
    this.form = {
      name: user.name,
      email: user.email,
      studentId: user.studentId ?? '',
      department: user.department ?? '',
      phone: user.phone ?? '',
      bio: user.bio ?? ''
    };
    this.photoPreview.set(user.photoUrl ?? '');
    this.photoError.set('');
    this.photoUploaded.set(false);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photoUploaded.set(false);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.photoError.set('Choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.photoError.set('The photo must be smaller than 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => this.resizePhoto(String(reader.result));
    reader.onerror = () => this.photoError.set('Could not read that image.');
    reader.readAsDataURL(file);
  }

  private resizePhoto(source: string): void {
    const image = new Image();
    image.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        this.photoError.set('Could not process that image.');
        return;
      }

      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.72);
      if (photoDataUrl.length > 450 * 1024) {
        this.photoError.set('This photo is too large to save in the profile. Choose a smaller image.');
        return;
      }
      this.photoPreview.set(photoDataUrl);
      void this.uploadPhoto(photoDataUrl);
    };
    image.onerror = () => this.photoError.set('Could not process that image.');
    image.src = source;
  }

  private async uploadPhoto(photoDataUrl: string): Promise<void> {
    this.photoUploading.set(true);
    this.photoError.set('');
    this.photoUploaded.set(false);
    this.saved.set(false);
    try {
      await this.auth.updateProfile({ photoUrl: photoDataUrl });
      this.photoPreview.set(this.auth.user()?.photoUrl ?? photoDataUrl);
      this.photoUploaded.set(true);
    } catch (error) {
      console.error('Profile photo upload failed.', error);
      this.photoError.set(this.firebaseErrorMessage(error));
    } finally {
      this.photoUploading.set(false);
    }
  }

  removePhoto(): void {
    this.photoPreview.set('');
    this.photoError.set('');
    this.photoUploaded.set(false);
    this.saved.set(false);
  }

  async saveProfile(): Promise<void> {
    if (!this.form.name.trim() || !this.form.email.trim()) return;
    this.saving.set(true);
    this.photoError.set('');
    try {
      await this.auth.updateProfile({
        name: this.form.name.trim(),
        email: this.form.email.trim(),
        studentId: this.form.studentId?.trim() || undefined,
        department: this.form.department?.trim() || undefined,
        phone: this.form.phone?.trim() || undefined,
        bio: this.form.bio?.trim() || undefined,
        photoUrl: this.photoPreview()
      });
      this.saved.set(true);
    } catch (error) {
      console.error('Profile update failed.', error);
      this.photoError.set(this.firebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private firebaseErrorMessage(error: unknown): string {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      return 'Firestore denied the profile update. Check your account access and Firestore rules.';
    }
    if (code === 'resource-exhausted') {
      return 'Firestore could not save the photo because a document size or quota limit was reached. Choose a smaller photo.';
    }
    return `Could not save your profile${code ? ` (${code})` : ''}. Check Firestore access and try again.`;
  }
}
