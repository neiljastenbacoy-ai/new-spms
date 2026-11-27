export type UserRole = 'student' | 'project_leader' | 'adviser' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  studentId?: string;
  photoUrl?: string;
  department?: string;
  program?: string;
  phone?: string;
  bio?: string;
  isActive?: boolean;
}

export const PROGRAMS = [
  'Information Technology',
  'Electrical Mechanical Technology',
  'Technology Communication Management'
] as const;

export type Program = typeof PROGRAMS[number];

export type ProjectStatus = 'ongoing' | 'completed' | 'on_hold' | 'overdue';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'overdue';

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  leaderId: string;
  memberIds: string[];
  adviserId?: string;
  createdAt: string;
  deadline?: string;
  /** Optional 24-hour `HH:mm` for the deadline. */
  deadlineTime?: string;
  color?: string;
  feedback?: string[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  /** Optional 24-hour `HH:mm` for the due date. */
  dueTime?: string;
  completedAt?: string;
  createdAt: string;
}

export interface Contribution {
  userId: string;
  projectId: string;
  tasksCompleted: number;
  filesUploaded: number;
  comments: number;
  score: number;
}

export interface ContributionSummary {
  user: User;
  assignedTasks: number;
  completedTasks: number;
  filesUploaded: number;
  recordedActivities: number;
}

export interface SystemSettings {
  academicYear: string;
  semester: string;
  registrationOpen: boolean;
}

export interface AuditRecord {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  details: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: 'task_assigned' | 'file_uploaded' | 'file_downloaded' | 'comment' | 'status_update' | 'member_added';
  message: string;
  userId: string;
  projectId?: string;
  createdAt: string;
}

export interface DeadlineItem {
  id: string;
  projectId: string;
  title: string;
  projectTitle: string;
  dueDate: string;
  /** Optional 24-hour `HH:mm` carried from the project deadline or task. */
  dueTime?: string;
  type: 'report' | 'documentation' | 'defense' | 'task';
}

export interface FileItem {
  id: string;
  name: string;
  projectId: string;
  uploadedBy: string;
  size: number;
  uploadedAt: string;
  type: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  body: string;
  createdAt: string;
}

export type NotificationKind = 'account_disabled' | 'account_enabled' | 'role_changed' | 'system';

export interface AppNotification {
  id: string;
  /** Recipient — the account this notice belongs to. */
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}
