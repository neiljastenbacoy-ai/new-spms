import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/models';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowed = (route.data['roles'] ?? []) as UserRole[];

  return auth.ready.then(() => {
    if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
    if (allowed.length === 0 || allowed.includes(auth.role() as UserRole)) return true;
    return router.createUrlTree(['/dashboard']);
  });
};
