import { effect, Injectable, signal, computed } from '@angular/core';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import {
  Activity,
  AuditRecord,
  ContributionSummary,
  DeadlineItem,
  FileItem,
  Project,
  SystemSettings,
  Task,
  User
} from '../models/models';
import { AuthService } from './auth.service';
import { LocalFileStoreService } from './local-file-store.service';
import { firestore } from '../firebase.config';

const PROJECT_QUERY_LIMIT = 30;
const FIRESTORE_BATCH_LIMIT = 450;
export const MAX_SHARED_FILE_BYTES = 500 * 1024;
const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  academicYear: '',
  semester: '',
  registrationOpen: true
};

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly _projects = signal<Project[]>([]);
  private readonly _tasks = signal<Task[]>([]);
  private readonly _activities = signal<Activity[]>([]);
  private readonly _deadlines = signal<DeadlineItem[]>([]);
  private readonly _team = signal<User[]>([]);
  private readonly _files = signal<FileItem[]>([]);
  private readonly _localFiles = signal<FileItem[]>([]);
  private readonly _auditLogs = signal<AuditRecord[]>([]);
  private readonly _systemSettings = signal<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);

  readonly projects = this._projects.asReadonly();
  readonly tasks = this._tasks.asReadonly();
  readonly activities = this._activities.asReadonly();
  readonly deadlines = this._deadlines.asReadonly();
  readonly team = this._team.asReadonly();
  readonly files = this._files.asReadonly();
  readonly localFiles = this._localFiles.asReadonly();
  readonly auditLogs = this._auditLogs.asReadonly();
  readonly systemSettings = this._systemSettings.asReadonly();

  readonly visibleTeamMembers = computed(() => {
    const user = this.auth.user();
    const team = this._team().filter(member => member.role !== 'adviser' && member.role !== 'admin');
    if (!user) return [];
    if (user.role === 'admin') return team;
    if (user.role === 'student') return team.filter(member => member.id === user.id);
    const memberIds = new Set(this._projects().flatMap(project => [
      ...project.memberIds,
      project.leaderId
    ]));
    return team.filter(member => memberIds.has(member.id));
  });

  readonly stats = computed(() => {
    const user = this.auth.user();
    const participants = new Set(this._projects().flatMap(project => [
      ...project.memberIds,
      project.leaderId
    ]));
    const tasks = user?.role === 'student'
      ? this._tasks().filter(task => task.assigneeId === user.id)
      : this._tasks();
    return {
      totalProjects: this._projects().length,
      completedTasks: tasks.filter(task => task.status === 'completed').length,
      pendingTasks: tasks.filter(task => task.status !== 'completed').length,
      teamMembers: user?.role === 'admin' ? this._team().length : participants.size,
      overdueTasks: tasks.filter(task =>
        task.status !== 'completed' && task.dueDate < new Date().toISOString().slice(0, 10)
      ).length
    };
  });

  readonly workload = computed(() => {
    const tasks = this._tasks();
    const activeTasks = tasks.filter(task => task.status !== 'completed');
    const team = this.visibleTeamMembers();
    const total = activeTasks.length;
    return team.map(member => {
      const assigned = activeTasks.filter(task => task.assigneeId === member.id).length;
      return {
        user: member,
        load: total ? Math.round((assigned / total) * 100) : 0,
        assigned
      };
    });
  });

  readonly contributions = computed<ContributionSummary[]>(() => {
    const currentUser = this.auth.user();
    const projects = this._projects();
    const isAdmin = currentUser?.role === 'admin';
    const participantIds = new Set(projects.flatMap(project => [
      ...project.memberIds,
      project.leaderId
    ]));
    const participants = this.visibleTeamMembers().filter(member => {
      if (isAdmin) return true;
      if (currentUser?.role === 'student') return member.id === currentUser.id;
      return participantIds.has(member.id);
    });
    return participants.map(user => ({
      user,
      assignedTasks: this._tasks().filter(task => task.assigneeId === user.id).length,
      completedTasks: this._tasks().filter(task =>
        task.assigneeId === user.id && task.status === 'completed'
      ).length,
      filesUploaded: this._files().filter(file => file.uploadedBy === user.id).length,
      recordedActivities: this._activities().filter(activity => activity.userId === user.id).length
    }));
  });

  constructor(
    private readonly auth: AuthService,
    private readonly localFileStore: LocalFileStoreService
  ) {
    effect(onCleanup => {
      const currentUser = this.auth.user();
      this.clearData();
      if (!currentUser) return;

      let disposed = false;
      let localFilesRequest = 0;
      const relatedUnsubscribers: Unsubscribe[] = [];
      let relatedProjectIds = '';
      let stopRelatedListeners: Unsubscribe[] = [];
      const directoryUnsubscribe = onSnapshot(
        collection(firestore, 'teamDirectory'),
        snapshot => this._team.set(this.mapDocuments<User>(snapshot.docs)),
        error => console.error('Unable to load the team directory from Firestore.', error)
      );
      const settingsUnsubscribe = onSnapshot(
        doc(firestore, 'systemSettings', 'general'),
        snapshot => this._systemSettings.set({
          ...DEFAULT_SYSTEM_SETTINGS,
          ...(snapshot.exists() ? snapshot.data() as Partial<SystemSettings> : {})
        }),
        error => console.error('Unable to load system settings from Firestore.', error)
      );
      const auditUnsubscribe = currentUser.role === 'admin'
        ? onSnapshot(
            query(collection(firestore, 'auditLogs'), orderBy('createdAt', 'desc'), limit(50)),
            snapshot => this._auditLogs.set(this.mapDocuments<AuditRecord>(snapshot.docs)),
            error => console.error('Unable to load administrative audit records.', error)
          )
        : null;

      const projectsCollection = collection(firestore, 'projects');
      const projectsQuery = currentUser.role === 'admin'
        ? query(projectsCollection)
        : currentUser.role === 'adviser'
          ? query(projectsCollection, where('adviserId', '==', currentUser.id))
          : currentUser.role === 'project_leader'
            ? query(projectsCollection, where('leaderId', '==', currentUser.id))
            : query(projectsCollection, where('memberIds', 'array-contains', currentUser.id));

      const projectUnsubscribe = onSnapshot(
        projectsQuery,
        snapshot => {
          const projects = this.mapDocuments<Project>(snapshot.docs);
          this._projects.set(projects);
          this.rebuildDeadlines();

          const ids = projects.map(project => project.id);
          const nextKey = ids.join('|');
          if (nextKey === relatedProjectIds) return;
          relatedProjectIds = nextKey;
          stopRelatedListeners.forEach(unsubscribe => unsubscribe());
          stopRelatedListeners = [];

          this.listenTasks(currentUser, ids, stopRelatedListeners);
          this.listenProjectCollection<Activity>('activities', ids, stopRelatedListeners, rows => {
            this._activities.set(rows);
          });
          this.listenProjectCollection<FileItem>('files', ids, stopRelatedListeners, rows => {
            this._files.set(rows);
          });
          const requestId = ++localFilesRequest;
          void this.loadLocalFiles(
            currentUser.id,
            ids,
            () => disposed || requestId !== localFilesRequest
          );
        },
        error => console.error('Unable to load projects from Firestore.', error)
      );

      relatedUnsubscribers.push(projectUnsubscribe, directoryUnsubscribe, settingsUnsubscribe);
      if (auditUnsubscribe) relatedUnsubscribers.push(auditUnsubscribe);
      onCleanup(() => {
        disposed = true;
        relatedUnsubscribers.forEach(unsubscribe => unsubscribe());
        stopRelatedListeners.forEach(unsubscribe => unsubscribe());
      });
    });
  }

  getProjectsByUser(userId: string): Project[] {
    return this._projects().filter(project =>
      project.memberIds.includes(userId) || project.leaderId === userId || project.adviserId === userId
    );
  }

  getTasksByUser(userId: string): Task[] {
    return this._tasks().filter(task => task.assigneeId === userId);
  }

  async addProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<void> {
    const actor = this.requireUser();
    const createdAt = new Date().toISOString().slice(0, 10);
    const batch = writeBatch(firestore);
    batch.set(doc(collection(firestore, 'projects')), { ...project, createdAt });
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      'project.created',
      undefined,
      project.title,
      `Created project “${project.title}”.`
    ));
    await batch.commit();
  }

  async updateTaskStatus(taskId: string, status: Task['status']): Promise<void> {
    const task = this._tasks().find(item => item.id === taskId);
    if (!task) throw new Error('Task is no longer available.');
    const user = this.requireUser();
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'tasks', taskId), {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : ''
    });
    batch.set(doc(collection(firestore, 'activities')), {
      projectId: task.projectId,
      userId: user.id,
      type: 'status_update',
      message: `Updated task status: ${task.title}`,
      createdAt: new Date().toISOString()
    });
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      user,
      'task.status_updated',
      taskId,
      task.title,
      `Changed task “${task.title}” to ${status.replace('_', ' ')}.`
    ));
    await batch.commit();
  }

  async addTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<void> {
    const user = this.requireUser();
    const createdAt = new Date().toISOString().slice(0, 10);
    const batch = writeBatch(firestore);
    const taskReference = doc(collection(firestore, 'tasks'));
    batch.set(taskReference, { ...task, createdAt });
    batch.set(doc(collection(firestore, 'activities')), {
      projectId: task.projectId,
      userId: user.id,
      type: 'task_assigned',
      message: `Assigned task: ${task.title}`,
      createdAt: new Date().toISOString()
    });
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      user,
      'task.created',
      taskReference.id,
      task.title,
      `Assigned “${task.title}” to ${this._team().find(member => member.id === task.assigneeId)?.name ?? 'a team member'}.`
    ));
    await batch.commit();
  }

  async updateProject(projectId: string, changes: Partial<Project>): Promise<void> {
    const actor = this.requireUser();
    const project = this._projects().find(item => item.id === projectId);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'projects', projectId), changes);
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      'project.updated',
      projectId,
      project?.title,
      `Updated ${project?.title ?? 'project'}: ${Object.keys(changes).join(', ')}.`
    ));
    await batch.commit();
  }

  async addProjectFeedback(projectId: string, feedback: string): Promise<void> {
    const actor = this.requireUser();
    const project = this._projects().find(item => item.id === projectId);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'projects', projectId), {
      feedback: arrayUnion(feedback)
    });
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      'project.feedback_added',
      projectId,
      project?.title,
      `Added adviser feedback to ${project?.title ?? 'project'}.`
    ));
    await batch.commit();
  }

  async deleteProject(projectId: string): Promise<void> {
    const actor = this.requireUser();
    const project = this._projects().find(item => item.id === projectId);
    const relatedTasks = this._tasks().filter(task => task.projectId === projectId);
    const relatedFiles = await getDocs(query(
      collection(firestore, 'files'),
      where('projectId', '==', projectId)
    ));

    const cleanupRefs = [
      ...relatedTasks.map(task => doc(firestore, 'tasks', task.id)),
      ...relatedFiles.docs.flatMap(file => [
        doc(firestore, 'files', file.id),
        doc(firestore, 'fileContents', file.id)
      ])
    ];
    for (let offset = 0; offset < cleanupRefs.length; offset += FIRESTORE_BATCH_LIMIT) {
      const cleanupBatch = writeBatch(firestore);
      cleanupRefs
        .slice(offset, offset + FIRESTORE_BATCH_LIMIT)
        .forEach(reference => cleanupBatch.delete(reference));
      await cleanupBatch.commit();
    }

    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'projects', projectId));
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      'project.deleted',
      projectId,
      project?.title,
      `Deleted project “${project?.title ?? projectId}” and its related records.`
    ));
    await batch.commit();
    this._files.update(files => files.filter(file => file.projectId !== projectId));
  }

  async uploadFile(file: File, projectId: string, uploadedBy: string): Promise<void> {
    const actor = this.requireUser();
    if (actor.id !== uploadedBy) throw new Error('You can only upload files as the signed-in user.');
    if (file.size > MAX_SHARED_FILE_BYTES) {
      throw new Error('Project files must be 500 KiB or smaller.');
    }
    if (!this._projects().some(project => project.id === projectId)) {
      throw new Error('You do not have access to this project.');
    }

    const fileItem: FileItem = {
      id: crypto.randomUUID(),
      name: file.name,
      projectId,
      uploadedBy: actor.id,
      size: file.size,
      uploadedAt: new Date().toISOString().slice(0, 10),
      type: file.type || 'application/octet-stream'
    };
    const dataBase64 = await this.encodeFile(file);
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'files', fileItem.id), fileItem);
    batch.set(doc(firestore, 'fileContents', fileItem.id), {
      projectId,
      uploadedBy: actor.id,
      contentType: fileItem.type,
      dataBase64
    });
    const project = this._projects().find(item => item.id === projectId);
    batch.set(doc(collection(firestore, 'activities')), {
      projectId,
      userId: actor.id,
      userName: actor.name,
      type: 'file_uploaded',
      message: `Uploaded ${file.name}`,
      createdAt: new Date().toISOString()
    });
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      'file.uploaded',
      fileItem.id,
      file.name,
      `Uploaded ${file.name} to ${project?.title ?? 'project'}.`
    ));
    await batch.commit();
    this._files.update(files => [fileItem, ...files.filter(item => item.id !== fileItem.id)]);
  }

  async downloadFile(file: FileItem): Promise<Blob> {
    this.requireUser();
    const snapshot = await getDoc(doc(firestore, 'fileContents', file.id));
    if (!snapshot.exists()) throw new Error('File contents are no longer available.');
    const content = snapshot.data();
    const projectId = content['projectId'];
    const contentType = content['contentType'];
    const dataBase64 = content['dataBase64'];
    if (
      projectId !== file.projectId
      || typeof contentType !== 'string'
      || typeof dataBase64 !== 'string'
    ) {
      throw new Error('The stored file contents are invalid.');
    }

    const binary = atob(dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new Blob([buffer], { type: contentType });
  }

  async removeFile(fileId: string): Promise<void> {
    const actor = this.requireUser();
    const file = this._files().find(item => item.id === fileId);
    if (!file) throw new Error('File is no longer available.');
    const project = this._projects().find(item => item.id === file.projectId);
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'files', fileId));
    batch.delete(doc(firestore, 'fileContents', fileId));
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      'file.deleted',
      fileId,
      file.name,
      `Removed ${file.name} from ${project?.title ?? 'project'}.`
    ));
    await batch.commit();
    this._files.update(files => files.filter(item => item.id !== fileId));
  }

  async shareLocalFile(fileId: string): Promise<void> {
    const actor = this.requireUser();
    const localFile = await this.localFileStore.get(actor.id, fileId);
    const file = new File([localFile.blob], localFile.name, { type: localFile.type });
    await this.uploadFile(file, localFile.projectId, actor.id);
    try {
      await this.localFileStore.remove(actor.id, fileId);
    } catch (error) {
      console.error('The file was shared, but its old local copy could not be removed.', error);
      throw new Error('File shared with the project, but the old browser-only copy could not be removed.');
    }
    this._localFiles.update(files => files.filter(item => item.id !== fileId));
  }

  async removeLocalFile(fileId: string): Promise<void> {
    const actor = this.requireUser();
    await this.localFileStore.remove(actor.id, fileId);
    this._localFiles.update(files => files.filter(item => item.id !== fileId));
  }

  async downloadLocalFile(fileId: string): Promise<Blob> {
    const actor = this.requireUser();
    const localFile = await this.localFileStore.get(actor.id, fileId);
    return localFile.blob;
  }

  async updateTeamMemberRole(userId: string, role: User['role']): Promise<void> {
    const actor = this.requireAdmin();
    const target = this._team().find(member => member.id === userId);
    if (!target) throw new Error('User is no longer available.');
    if (target.role === role) return;
    if (target.role === 'admin' && role !== 'admin' && this.activeAdminCount() <= 1) {
      throw new Error('The system must keep at least one active administrator.');
    }
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'users', userId), { role });
    batch.update(doc(firestore, 'teamDirectory', userId), { role });
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      'user.role_changed',
      userId,
      target.name,
      `Changed role from ${target.role} to ${role}.`
    ));
    await batch.commit();
  }

  async setUserActive(userId: string, isActive: boolean): Promise<void> {
    const actor = this.requireAdmin();
    const target = this._team().find(member => member.id === userId);
    if (!target) throw new Error('User is no longer available.');
    if (actor.id === userId && !isActive) throw new Error('You cannot disable your own account.');
    if ((target.isActive !== false) === isActive) return;
    if (!isActive && target.role === 'admin' && this.activeAdminCount() <= 1) {
      throw new Error('The system must keep at least one active administrator.');
    }
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'users', userId), { isActive });
    batch.update(doc(firestore, 'teamDirectory', userId), { isActive });
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      isActive ? 'user.account_enabled' : 'user.account_disabled',
      userId,
      target.name,
      isActive ? 'Enabled account access.' : 'Disabled account access.'
    ));
    await batch.commit();
  }

  async updateSystemSettings(changes: SystemSettings): Promise<void> {
    const actor = this.requireAdmin();
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'systemSettings', 'general'), {
      ...changes,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id
    }, { merge: true });
    batch.set(doc(collection(firestore, 'auditLogs')), this.auditEntry(
      actor,
      'system.settings_updated',
      undefined,
      undefined,
      `Updated academic year, semester, and registration settings.`
    ));
    await batch.commit();
  }

  private listenTasks(user: User, projectIds: string[], unsubscribers: Unsubscribe[]): void {
    if (user.role === 'student') {
      this.listenProjectCollection<Task>('tasks', projectIds, unsubscribers, rows => {
          this._tasks.set(rows.filter(task => task.assigneeId === user.id));
          this.rebuildDeadlines();
      });
      return;
    }

    this.listenProjectCollection<Task>('tasks', projectIds, unsubscribers, rows => {
      this._tasks.set(rows);
      this.rebuildDeadlines();
    });
  }

  private listenProjectCollection<T extends { id: string }>(
    collectionName: string,
    projectIds: string[],
    unsubscribers: Unsubscribe[],
    onRows: (rows: T[]) => void
  ): void {
    if (!projectIds.length) {
      onRows([]);
      return;
    }

    const chunks: string[][] = [];
    for (let index = 0; index < projectIds.length; index += PROJECT_QUERY_LIMIT) {
      chunks.push(projectIds.slice(index, index + PROJECT_QUERY_LIMIT));
    }

    const documents = new Map<string, T>();
    chunks.forEach(projectIdChunk => {
      unsubscribers.push(onSnapshot(
        query(collection(firestore, collectionName), where('projectId', 'in', projectIdChunk)),
        snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'removed') documents.delete(change.doc.id);
            else documents.set(change.doc.id, this.mapDocument<T>(change.doc));
          });
          onRows([...documents.values()]);
        },
        error => console.error(`Unable to load ${collectionName} from Firestore.`, error)
      ));
    });
  }

  private mapDocuments<T extends { id: string }>(documents: QueryDocumentSnapshot<DocumentData>[]): T[] {
    return documents.map(document => this.mapDocument<T>(document));
  }

  private mapDocument<T extends { id: string }>(document: QueryDocumentSnapshot<DocumentData>): T {
    return { ...document.data(), id: document.id } as T;
  }

  private rebuildDeadlines(): void {
    const projectDeadlines: DeadlineItem[] = this._projects()
      .filter(project => project.status !== 'completed' && !!project.deadline)
      .map(project => ({
        id: `project-${project.id}`,
        title: `${project.title} deadline`,
        projectTitle: project.title,
        dueDate: project.deadline!,
        type: 'report'
      }));
    const taskDeadlines: DeadlineItem[] = this._tasks()
      .filter(task => task.status !== 'completed')
      .map(task => ({
        id: task.id,
        title: task.title,
        projectTitle: this._projects().find(project => project.id === task.projectId)?.title ?? 'Project',
        dueDate: task.dueDate,
        type: 'task'
      }));
    this._deadlines.set([...projectDeadlines, ...taskDeadlines].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
  }

  private requireUser(): User {
    const user = this.auth.user();
    if (!user) throw new Error('Sign in before changing project data.');
    return user;
  }

  private requireAdmin(): User {
    const user = this.requireUser();
    if (user.role !== 'admin') throw new Error('Administrator access is required.');
    return user;
  }

  private activeAdminCount(): number {
    return this._team().filter(member => member.role === 'admin' && member.isActive !== false).length;
  }

  private auditEntry(
    actor: User,
    action: string,
    targetId: string | undefined,
    targetName: string | undefined,
    details: string
  ): Omit<AuditRecord, 'id'> {
    const record: Omit<AuditRecord, 'id'> = {
      action,
      actorId: actor.id,
      actorName: actor.name,
      details,
      createdAt: new Date().toISOString()
    };
    if (targetId) record.targetId = targetId;
    if (targetName) record.targetName = targetName;
    return record;
  }

  private async loadLocalFiles(
    userId: string,
    projectIds: string[],
    isDisposed: () => boolean
  ): Promise<void> {
    try {
      const files = await this.localFileStore.list(userId, projectIds);
      if (!isDisposed()) this._localFiles.set(files);
    } catch (error) {
      if (!isDisposed()) console.error('Unable to load local project files.', error);
    }
  }

  private async encodeFile(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  private clearData(): void {
    this._projects.set([]);
    this._tasks.set([]);
    this._activities.set([]);
    this._deadlines.set([]);
    this._team.set([]);
    this._files.set([]);
    this._localFiles.set([]);
    this._auditLogs.set([]);
    this._systemSettings.set(DEFAULT_SYSTEM_SETTINGS);
  }
}
