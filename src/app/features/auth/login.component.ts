import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { PROGRAMS } from '../../core/models/models';

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
          <div class="brand-text">
            <span class="eyebrow">SPMS · Project register</span>
            <h1>Student Project<br />Management System</h1>
          </div>
        </div>

        <form (ngSubmit)="onSubmit()" class="form">
          @if (isRegistering()) {
            <label class="inline-row">
              <span>Full name</span>
              <div class="input-wrap">
                <span class="field-icon">◉</span>
                <input [(ngModel)]="displayName" name="displayName" placeholder="Your name" autocomplete="name" required />
              </div>
            </label>
            <label>
              <span>Program</span>
              <div class="input-wrap">
                <span class="field-icon">▦</span>
                <select [(ngModel)]="program" name="program" autocomplete="organization">
                  <option value="">Choose your program</option>
                  @for (p of programs; track p) {
                    <option [value]="p">{{ p }}</option>
                  }
                </select>
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
          <button type="button" (click)="toggleMode()">{{ isRegistering() ? 'Sign in' : 'Create a student account' }}</button>
          @if (!isRegistering()) {
            <button type="button" class="reset-button" (click)="resetPassword()">Forgot password?</button>
          }
        </div>

      </div>

      <div class="side-art">
        <div class="side-copy">
          <span class="side-kicker">USTP · Project register</span>
          <h2>Good work,<br /><em>well documented.</em></h2>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr);
      min-height: 100vh;
      background: var(--surface);
    }

    /* ------------------------------------------------------------ toggle */
    .theme-toggle {
      position: absolute;
      top: 1.35rem;
      right: 1.35rem;
      z-index: 20;
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(244, 237, 220, .28);
      border-radius: 2px;
      background: rgba(6, 20, 15, .35);
      color: #f4eddc;
      font-size: 1rem;
      cursor: pointer;
    }

    .theme-toggle:hover {
      border-color: rgba(244, 237, 220, .6);
      background: rgba(6, 20, 15, .6);
    }

    /* -------------------------------------------------------------- form */
    .login-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      max-width: 560px;
      margin: 0 auto;
      padding: 3.25rem clamp(1.5rem, 5vw, 4rem);
      background: var(--surface);
      min-width: 0;
    }

    .brand {
      display: flex;
      align-items: flex-start;
      gap: .95rem;
      margin-bottom: 2rem;
      padding-bottom: 1.4rem;
      border-bottom: 1px solid var(--border);
    }

    .logo {
      flex: 0 0 46px;
      width: 46px;
      height: 46px;
      object-fit: contain;
    }

    .brand-text { min-width: 0; }

    .eyebrow {
      display: block;
      font-family: var(--font-mono);
      font-size: .56rem;
      font-weight: 500;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: .45rem;
    }

    h1 {
      margin: 0 0 .45rem;
      font-family: var(--font-display);
      font-size: clamp(1.65rem, 2.6vw, 2.1rem);
      font-weight: 400;
      line-height: 1.03;
      letter-spacing: -.04em;
      color: var(--text);
    }

    .brand p {
      font-size: .82rem;
      color: var(--muted);
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: .95rem;
      max-width: 460px;
    }

    .inline-row {
      flex-direction: row;
      align-items: flex-start;
      gap: .75rem;
    }

    .inline-row > span {
      flex: 0 0 auto;
      width: 5rem;
      padding-top: .3rem;
    }

    .inline-row .input-wrap {
      flex: 1 1 auto;
      min-width: 0;
    }

    .input-wrap select {
      width: 100%;
      height: 46px;
      padding: 0 2.2rem 0 2.5rem;
      appearance: none;
      background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\"><path fill=\"%2352635c\" d=\"M5 7l5 5 5-5z\"/></svg>');
      background-repeat: no-repeat;
      background-position: right .7rem center;
      background-size: 1.1rem;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: var(--field);
      color: var(--text);
      font-size: .86rem;
      font-family: var(--body);
      cursor: pointer;
    }

    .input-wrap select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    label {
      display: flex;
      flex-direction: column;
      gap: .4rem;
    }

    label > span {
      font-family: var(--font-mono);
      font-size: .56rem;
      font-weight: 500;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .input-wrap { position: relative; }

    input {
      width: 100%;
      height: 46px;
      padding: 0 4.4rem 0 2.5rem;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: var(--field);
      color: var(--text);
      font-size: .86rem;
    }

    input::placeholder { color: var(--muted); opacity: .7; }

    input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .field-icon {
      position: absolute;
      left: .85rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--muted);
      font-size: .8rem;
      pointer-events: none;
    }

    .password-toggle {
      position: absolute;
      right: .55rem;
      top: 50%;
      transform: translateY(-50%);
      padding: .2rem .35rem;
      border: 0;
      border-radius: 2px;
      background: transparent;
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: .55rem;
      font-weight: 500;
      letter-spacing: .12em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .password-toggle:hover { background: var(--hover); }

    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      height: 46px;
      margin-top: .35rem;
      padding: 0 1.15rem;
      border: 0;
      border-radius: 3px;
      background: var(--btn);
      color: #f7f1e1;
      font-family: var(--font-body);
      font-size: .82rem;
      font-weight: 600;
      letter-spacing: .03em;
      cursor: pointer;
      transition: background .16s ease, transform .16s ease, box-shadow .16s ease;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--btn-hover);
      transform: translateY(-1px);
      box-shadow: 0 12px 24px -18px rgba(20, 51, 42, .95);
    }

    .btn-primary:disabled { opacity: .55; cursor: not-allowed; }

    .arrow { font-size: 1rem; transition: transform .16s ease; }
    .btn-primary:hover:not(:disabled) .arrow { transform: translateX(3px); }

    .error {
      padding: .6rem .75rem;
      border: 1px solid rgba(161, 58, 44, .4);
      border-radius: 3px;
      background: var(--danger-soft);
      color: var(--danger);
      font-size: .78rem;
      line-height: 1.4;
    }

    .demo-hint {
      max-width: 460px;
      margin-top: 1.4rem;
      padding-top: 1.1rem;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: .78rem;
    }

    .auth-switch {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .4rem;
    }

    .auth-switch button {
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--accent);
      font-size: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .auth-switch button:hover { text-decoration: underline; text-underline-offset: 3px; }

    .auth-switch small {
      flex-basis: 100%;
      color: var(--muted);
      font-size: .72rem;
      line-height: 1.45;
    }

    .auth-switch .reset-button {
      flex-basis: 100%;
      margin-top: .3rem;
      text-align: left;
      font-family: var(--font-mono);
      font-size: .58rem;
      font-weight: 500;
      letter-spacing: .1em;
      text-transform: uppercase;
    }

    /* -------------------------------------------------------- side panel */
    .side-art {
      position: relative;
      display: flex;
      align-items: center;
      overflow: hidden;
      padding: clamp(2.5rem, 6vw, 6rem);
      background:
        repeating-linear-gradient(135deg, rgba(244, 237, 220, .04) 0 1px, transparent 1px 11px),
        linear-gradient(rgba(244, 237, 220, .05) 1px, transparent 1px) 0 0 / 100% 96px,
        linear-gradient(90deg, rgba(244, 237, 220, .05) 1px, transparent 1px) 0 0 / 96px 100%,
        radial-gradient(120% 90% at 100% 0%, rgba(179, 132, 60, .24), transparent 60%),
        linear-gradient(140deg, #17392e 0%, #14332a 55%, #0b201a 100%);
      color: #f4eddc;
    }

    .side-art::after {
      content: '';
      position: absolute;
      right: -140px;
      bottom: -180px;
      width: 460px;
      height: 460px;
      border-radius: 50%;
      border: 1px solid rgba(244, 237, 220, .12);
      box-shadow: 0 0 0 60px rgba(244, 237, 220, .022), 0 0 0 120px rgba(244, 237, 220, .014);
      pointer-events: none;
    }

    .side-copy {
      position: relative;
      z-index: 2;
      max-width: 520px;
    }

    .side-kicker {
      display: inline-block;
      margin-bottom: 1.3rem;
      font-family: var(--font-mono);
      font-size: .58rem;
      font-weight: 500;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: #d9c39a;
    }

    .side-copy h2 {
      margin: 0 0 1.2rem;
      font-family: var(--font-display);
      font-size: clamp(2.4rem, 4.4vw, 4.2rem);
      font-weight: 400;
      line-height: .94;
      letter-spacing: -.05em;
      color: #f6efdd;
    }

    .side-copy h2 em {
      font-style: italic;
      color: #e0b784;
    }

    .side-copy p {
      max-width: 42ch;
      color: #b3c4b4;
      font-size: .9rem;
      line-height: 1.6;
    }

    .register-list {
      list-style: none;
      margin: 2.25rem 0 0;
      padding: 0;
      max-width: 440px;
      border-top: 1px solid rgba(244, 237, 220, .18);
    }

    .register-list li {
      display: grid;
      grid-template-columns: 2rem auto 1fr;
      align-items: baseline;
      gap: .75rem;
      padding: .72rem 0;
      border-bottom: 1px solid rgba(244, 237, 220, .13);
    }

    .register-list .num {
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .06em;
      color: #8ea78f;
    }

    .register-list strong {
      font-size: .82rem;
      font-weight: 600;
      letter-spacing: .01em;
      color: #f4eddc;
    }

    .register-list .desc {
      justify-self: end;
      text-align: right;
      font-family: var(--font-mono);
      font-size: .55rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #93a894;
    }

    /* --------------------------------------------------------- responsive */
    @media (max-width: 900px) {
      .login-page { grid-template-columns: 1fr; }
      .side-art { display: none; }
      .login-card { min-height: 100vh; padding: 2.25rem 1.25rem; }
      .theme-toggle {
        border-color: var(--border);
        background: var(--field);
        color: var(--text);
      }
      .brand { margin-bottom: 1.6rem; }
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

  readonly programs = PROGRAMS;
  program = '';

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
    if (this.isRegistering() && !this.program) {
      this.error.set('Choose your program.');
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
        await this.auth.register(this.displayName, this.email, this.password, this.program);
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
