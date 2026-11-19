import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'projects',
        canActivate: [roleGuard],
        data: { roles: ['student', 'project_leader', 'adviser'] },
        loadComponent: () => import('./features/projects/projects.component').then(m => m.ProjectsComponent)
      },
      {
        path: 'tasks',
        canActivate: [roleGuard],
        data: { roles: ['student', 'project_leader'] },
        loadComponent: () => import('./features/tasks/tasks.component').then(m => m.TasksComponent)
      },
      {
        path: 'workload',
        canActivate: [roleGuard],
        data: { roles: ['project_leader'] },
        loadComponent: () => import('./features/workload/workload.component').then(m => m.WorkloadComponent)
      },
      {
        path: 'contributions',
        canActivate: [roleGuard],
        data: { roles: ['student', 'project_leader', 'adviser'] },
        loadComponent: () => import('./features/contributions/contributions.component').then(m => m.ContributionsComponent)
      },
      {
        path: 'deadlines',
        canActivate: [roleGuard],
        data: { roles: ['student', 'project_leader'] },
        loadComponent: () => import('./features/deadlines/deadlines.component').then(m => m.DeadlinesComponent)
      },
      {
        path: 'files',
        canActivate: [roleGuard],
        data: { roles: ['student', 'project_leader', 'adviser'] },
        loadComponent: () => import('./features/files/files.component').then(m => m.FilesComponent)
      },
      {
        path: 'adviser',
        canActivate: [roleGuard],
        data: { roles: ['adviser'] },
        loadComponent: () => import('./features/adviser/adviser.component').then(m => m.AdviserComponent)
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
