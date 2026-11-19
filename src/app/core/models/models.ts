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
  phone?: string;
  bio?: string;
  isActive?: boolean;
}

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
  type: 'task_assigned' | 'file_uploaded' | 'comment' | 'status_update' | 'member_added';
  message: string;
  userId: string;
  projectId?: string;
  createdAt: string;
}

export interface DeadlineItem {
  id: string;
  title: string;
  projectTitle: string;
  dueDate: string;
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
