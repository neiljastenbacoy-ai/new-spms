import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { firebaseAuth, firestore } from '../firebase.config';
import { User, UserRole } from '../models/models';

type EditableProfile = Pick<User, 'name' | 'email' | 'studentId' | 'department' | 'phone' | 'bio' | 'photoUrl'>;

const isUserRole = (role: unknown): role is UserRole =>
  role === 'student' || role === 'project_leader' || role === 'adviser' || role === 'admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null>(null);
  private readonly _initialized = signal(false);
  private profileUnsubscribe: Unsubscribe | null = null;
  private resolveReady!: () => void;
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly role = computed(() => this._user()?.role ?? null);
  readonly initialized = this._initialized.asReadonly();
  readonly ready = new Promise<void>(resolve => {
    this.resolveReady = resolve;
  });

  constructor(private readonly router: Router) {
    onAuthStateChanged(firebaseAuth, async firebaseUser => {
      this.profileUnsubscribe?.();
      this.profileUnsubscribe = null;
      try {
        if (!firebaseUser) {
          this._user.set(null);
          return;
        }
        const profile = await this.loadProfile(firebaseUser.uid, firebaseUser.email, firebaseUser.displayName);
        if (firebaseAuth.currentUser?.uid !== firebaseUser.uid) return;
        if (profile.isActive === false) {
          this._user.set(null);
          await signOut(firebaseAuth);
          return;
        }
        this._user.set(profile);
        this.profileUnsubscribe = onSnapshot(
          doc(firestore, 'users', firebaseUser.uid),
          snapshot => {
            if (snapshot.exists() && firebaseAuth.currentUser?.uid === firebaseUser.uid) {
              const updatedProfile = this.mapProfile(
                firebaseUser.uid,
                snapshot.data() as Partial<User>,
                firebaseUser.email,
                firebaseUser.displayName
              );
              if (updatedProfile.isActive === false) {
                this._user.set(null);
                void signOut(firebaseAuth);
                void this.router.navigate(['/login']);
                return;
              }
              this._user.set(updatedProfile);
            }
          },
          error => console.error('Unable to watch the signed-in user profile.', error)
        );
      } catch (error) {
        this._user.set(null);
        console.error('Unable to load the signed-in user profile from Firestore.', error);
      } finally {
        this._initialized.set(true);
        this.resolveReady();
      }
    });
  }

  async login(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const profile = await this.loadProfile(
      credential.user.uid,
      credential.user.email,
      credential.user.displayName
    );
    if (profile.isActive === false) {
      await signOut(firebaseAuth);
      throw Object.assign(new Error('This account has been disabled by an administrator.'), {
        code: 'spms/account-disabled'
      });
    }
    this._user.set(profile);
  }

  async register(name: string, email: string, password: string, program?: string): Promise<void> {
    const settings = await getDoc(doc(firestore, 'systemSettings', 'general'));
    if (settings.exists() && settings.data()['registrationOpen'] === false) {
      throw Object.assign(new Error('Student registration is currently closed.'), {
        code: 'spms/registration-closed'
      });
    }
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const cleanName = name.trim();
    await updateProfile(credential.user, { displayName: cleanName });
    const user: User = {
      id: credential.user.uid,
      name: cleanName,
      email: credential.user.email ?? email.trim(),
      role: 'student',
      avatar: this.initials(cleanName),
      isActive: true,
      program: program ?? ''
    };
    await Promise.all([
      setDoc(doc(firestore, 'users', user.id), user),
      setDoc(doc(firestore, 'teamDirectory', user.id), this.toDirectoryEntry(user))
    ]);
    this._user.set(user);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(firebaseAuth, email.trim());
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth);
    this._user.set(null);
    await this.router.navigate(['/login']);
  }

  async updateProfile(changes: Partial<EditableProfile>): Promise<void> {
    const current = this._user();
    const firebaseUser = firebaseAuth.currentUser;
    if (!current || !firebaseUser) throw new Error('You must be signed in to update your profile.');

    const patch: Partial<EditableProfile> = { ...changes };
    if (patch.email && patch.email !== firebaseUser.email) {
      await updateEmail(firebaseUser, patch.email.trim());
    }

    if (patch.name) {
      await updateProfile(firebaseUser, { displayName: patch.name.trim() });
    }

    const profilePatch = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [key, value ?? ''])
    );
    const updatedUser = { ...current, ...patch };
    await Promise.all([
      updateDoc(doc(firestore, 'users', current.id), profilePatch),
      setDoc(doc(firestore, 'teamDirectory', current.id), this.toDirectoryEntry(updatedUser), { merge: true })
    ]);
    this._user.set(updatedUser);
  }

  hasRole(...roles: UserRole[]): boolean {
    const currentRole = this.role();
    return currentRole ? roles.includes(currentRole) : false;
  }

  private async loadProfile(uid: string, email: string | null, displayName: string | null): Promise<User> {
    const userRef = doc(firestore, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      return this.mapProfile(uid, snapshot.data() as Partial<User>, email, displayName);
    }

    const user: User = {
      id: uid,
      name: displayName ?? email?.split('@')[0] ?? 'SPMS User',
      email: email ?? '',
      role: 'student',
      isActive: true
    };
    await Promise.all([
      setDoc(userRef, user),
      setDoc(doc(firestore, 'teamDirectory', uid), this.toDirectoryEntry(user))
    ]);
    return user;
  }

  private mapProfile(
    uid: string,
    profile: Partial<User>,
    email: string | null,
    displayName: string | null
  ): User {
    const name = profile.name ?? displayName ?? email?.split('@')[0] ?? 'SPMS User';
    return {
      id: uid,
      name,
      email: profile.email ?? email ?? '',
      role: isUserRole(profile.role) ? profile.role : 'student',
      isActive: profile.isActive !== false,
      avatar: profile.avatar ?? this.initials(name),
      studentId: profile.studentId,
      department: profile.department,
      phone: profile.phone,
      bio: profile.bio,
      photoUrl: profile.photoUrl
    };
  }

  private toDirectoryEntry(user: User): Pick<User, 'id' | 'name' | 'email' | 'role' | 'avatar' | 'photoUrl' | 'isActive' | 'program'> {
    const entry: Pick<User, 'id' | 'name' | 'email' | 'role' | 'avatar' | 'photoUrl' | 'isActive' | 'program'> = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
      program: user.program ?? ''
    };
    if (user.avatar) entry.avatar = user.avatar;
    entry.photoUrl = user.photoUrl ?? '';
    return entry;
  }

  private initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  }
}
