import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <button class="theme-toggle" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Use light mode' : 'Use dark mode'">
        {{ theme.isDark() ? '☀' : '☾' }}
      </button>
      <div class="login-card">
        <div class="brand">
          <img class="logo" src="/spms-emblem.png" alt="SPMS emblem" />
          <div>
            <span class="eyebrow">SPMS Workspace</span>
            <h1>Student Project<br />Management System</h1>
            <p>Plan. Collaborate. Achieve.</p>
          </div>
        </div>

        <form (ngSubmit)="onSubmit()" class="form">
          @if (isRegistering()) {
            <label>
              <span>Full name</span>
              <div class="input-wrap">
                <span class="field-icon">◉</span>
                <input [(ngModel)]="displayName" name="displayName" placeholder="Your name" autocomplete="name" required />
              </div>
            </label>
          }
          <label>
            <span>Email</span>
            <div class="input-wrap">
              <span class="field-icon">✉</span>
              <input type="email" [(ngModel)]="email" name="email" placeholder="name@spms.app" autocomplete="username" required />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div class="input-wrap">
              <span class="field-icon">◇</span>
              <input [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" name="password" placeholder="Enter your password" autocomplete="current-password" required />
              <button class="password-toggle" type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
          </label>

          @if (error()) {
            <div class="error">{{ error() }}</div>
          }

          <button type="submit" class="btn-primary" [disabled]="loading()">
            <span>{{ loading() ? 'Please wait…' : isRegistering() ? 'Create account' : 'Sign In' }}</span>
            @if (!loading()) { <span class="arrow">→</span> }
          </button>
        </form>

        <div class="demo-hint auth-switch">
          <span>{{ isRegistering() ? 'Already have an account?' : 'New to SPMS?' }}</span>
          <button type="button" (click)="toggleMode()">{{ isRegistering() ? 'Sign in' : 'Create a student account' }}</button>
          @if (isRegistering()) {
            <small>New accounts start with the Student role. An administrator can assign other roles.</small>
          } @else {
            <button type="button" class="reset-button" (click)="resetPassword()">Forgot password?</button>
          }
        </div>
      </div>
      <div class="side-art">
        <div class="orb orb-one"></div>
        <div class="orb orb-two"></div>
        <div class="side-copy">
          <span class="side-kicker">SMART PROJECT WORKSPACE</span>
          <h2>Turn ideas into<br /><em>remarkable results.</em></h2>
          <p>Manage projects, assignments, deadlines, and team progress in one focused workspace.</p>
          <div class="feature-row">
            <span>✓ Real-time workload</span>
            <span>✓ Deadline tracking</span>
            <span>✓ Team collaboration</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--bg, #f8fafc);
      position: relative;
    }
    .theme-toggle {
      position: absolute;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 20;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 12px;
      background: rgba(15,23,42,.18);
      backdrop-filter: blur(12px);
      color: #fff;
      font-size: 1.1rem;
      cursor: pointer;
    }
    .login-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem clamp(2rem, 6vw, 6.5rem);
      background: var(--surface, #fff);
      margin: 0 auto;
      width: 100%;
      min-width: 0;
    }
    .brand { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 2.25rem; }
    .logo {
      flex: 0 0 54px;
      width: 54px;
      height: 54px;
      object-fit: contain;
    }
    .eyebrow { color: #2563eb; font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    h1 { font-size: clamp(1.75rem, 3vw, 2.35rem); line-height: 1.08; color: var(--text, #0f172a); margin: .35rem 0 .5rem; letter-spacing: -.035em; }
    .brand p { color: var(--muted, #64748b); margin: 0; font-size: .9rem; }
    .form { display: flex; flex-direction: column; gap: 1rem; max-width: 520px; }
    label {
      display: flex;
      flex-direction: column;
      gap: .45rem;
      font-size: .84rem;
      font-weight: 700;
      color: var(--text, #334155);
    }
    .input-wrap { position: relative; }
    input {
      width: 100%;
      height: 52px;
      padding: .75rem 4rem .75rem 2.75rem;
      border: 1.5px solid var(--border, #e2e8f0);
      border-radius: 12px;
      background: var(--input, #fff);
      color: var(--text, #0f172a);
      font-size: .92rem;
      transition: .16s ease;
    }
    input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,.12); }
    .field-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); z-index: 1; color: #94a3b8; }
    .password-toggle { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); border: 0; background: transparent; color: #2563eb; font-size: .75rem; font-weight: 800; cursor: pointer; }
    .btn-primary {
      height: 52px;
      margin-top: .25rem;
      padding: 0 1.15rem;
      background: linear-gradient(135deg, #1e40af, #3b82f6);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-weight: 800;
      font-size: .92rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      box-shadow: 0 12px 24px rgba(37,99,235,.18);
    }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 16px 30px rgba(37,99,235,.28); }
    .btn-primary:disabled { opacity: .7; cursor: not-allowed; }
    .arrow { font-size: 1.15rem; }
    .error {
      background: rgba(239,68,68,.09); color: #dc2626; padding: .65rem .9rem; border-radius: 8px; font-size: .82rem;
    }
    .demo-hint { max-width: 520px; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border, #e2e8f0); color: var(--muted, #64748b); }
    .demo-hint > p { margin: 0 0 .65rem; font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .auth-switch { display:flex; flex-wrap:wrap; align-items:center; gap:.45rem; font-size:.82rem; }
    .auth-switch button { border:0; padding:0; background:transparent; color:#4f46e5; font-size:inherit; font-weight:800; cursor:pointer; }
    .auth-switch small { flex-basis:100%; color:var(--muted,#64748b); }
    .auth-switch .reset-button { flex-basis:100%; margin-top:.4rem; text-align:left; font-size:.76rem; }
    .side-art {
      background: linear-gradient(145deg, #08162f 0%, #102b62 52%, #1d4ed8 100%);
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      padding: clamp(3rem, 8vw, 8rem);
    }
    .side-art::before {
      content: '';
      position: absolute;
      width: 520px; height: 520px; right: -180px; bottom: -220px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 50%;
      box-shadow: 0 0 0 70px rgba(255,255,255,.025), 0 0 0 140px rgba(255,255,255,.018);
    }
    .orb { position: absolute; border-radius: 50%; filter: blur(2px); }
    .orb-one { width: 180px; height: 180px; right: 8%; top: 12%; background: rgba(96,165,250,.16); }
    .orb-two { width: 90px; height: 90px; left: 8%; bottom: 12%; background: rgba(251,191,36,.12); }
    .side-copy { position: relative; z-index: 2; max-width: 540px; color: #fff; }
    .side-kicker { display: inline-block; color: #fbbf24; font-size: .72rem; font-weight: 800; letter-spacing: .16em; margin-bottom: 1.25rem; }
    .side-copy h2 { font-size: clamp(2.6rem, 5vw, 5rem); line-height: .98; letter-spacing: -.055em; margin: 0 0 1.25rem; }
    .side-copy h2 em { color: #93c5fd; font-style: normal; }
    .side-copy p { max-width: 470px; color: #cbd5e1; line-height: 1.7; font-size: .95rem; }
    .feature-row { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: 1.5rem; }
    @media (max-width: 900px) {
      .login-page { grid-template-columns: 1fr; }
      .side-art { display: none; }
      .login-card { min-height: 100vh; padding: 2.5rem 1.25rem; }
      .theme-toggle { border-color: var(--border, #e2e8f0); background: var(--surface, #fff); color: var(--text, #0f172a); }
    }
  `]
})
export class LoginComponent {
  readonly theme = inject(ThemeService);
  displayName = '';
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);
  showPassword = signal(false);
  isRegistering = signal(false);

  constructor(private auth: AuthService, private router: Router) {
    void this.auth.ready.then(() => {
      if (this.auth.isLoggedIn()) void this.router.navigate(['/dashboard']);
    });
  }

  toggleMode(): void {
    this.error.set('');
    this.isRegistering.update(registering => !registering);
  }

  async onSubmit(): Promise<void> {
    this.error.set('');
    if (this.isRegistering() && !this.displayName.trim()) {
      this.error.set('Enter your name to create an account.');
      return;
    }
    if (!this.email.trim() || !this.password) {
      this.error.set('Enter your email and password.');
      return;
    }
    if (this.isRegistering() && this.password.length < 6) {
      this.error.set('Use a password with at least 6 characters.');
      return;
    }

    this.loading.set(true);
    try {
      if (this.isRegistering()) {
        await this.auth.register(this.displayName, this.email, this.password);
      } else {
        await this.auth.login(this.email, this.password);
      }
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.error.set(this.firebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async resetPassword(): Promise<void> {
    if (!this.email.trim()) {
      this.error.set('Enter your email first, then choose Forgot password.');
      return;
    }
    this.loading.set(true);
    try {
      await this.auth.resetPassword(this.email);
      this.error.set('Password reset email sent. Check your inbox.');
    } catch (error) {
      this.error.set(this.firebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private firebaseErrorMessage(error: unknown): string {
    const code = (error as { code?: string })?.code;
    if (code === 'spms/account-disabled') return 'This account has been disabled. Contact an administrator.';
    if (code === 'spms/registration-closed') return 'Student registration is currently closed. Contact an administrator.';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Email or password is incorrect.';
    }
    if (code === 'auth/email-already-in-use') return 'An account already uses this email.';
    if (code === 'auth/weak-password') return 'Use a stronger password with at least 6 characters.';
    if (code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (code === 'auth/operation-not-allowed') return 'Enable Email/Password sign-in in Firebase Authentication.';
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      return 'Firebase access was denied. Check Firestore Security Rules.';
    }
    return 'Firebase could not complete the request. Check the Firebase project setup and try again.';
  }
}
