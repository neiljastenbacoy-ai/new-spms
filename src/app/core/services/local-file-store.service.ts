import { Injectable } from '@angular/core';
import { FileItem } from '../models/models';

export interface LocalProjectFile extends FileItem {
  ownerId: string;
  blob: Blob;
}

@Injectable({ providedIn: 'root' })
export class LocalFileStoreService {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async list(ownerId: string, projectIds: string[]): Promise<FileItem[]> {
    if (!projectIds.length) return [];
    const database = await this.openDatabase();
    const transaction = database.transaction('projectFiles', 'readonly');
    const completed = this.waitForTransaction(transaction);
    const records = await this.requestResult(
      transaction.objectStore('projectFiles').index('ownerId').getAll(ownerId)
    );
    await completed;

    const visibleProjects = new Set(projectIds);
    return records
      .filter(record => visibleProjects.has(record.projectId))
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
      .map(({ id, name, projectId, uploadedBy, size, uploadedAt, type }) => ({
        id,
        name,
        projectId,
        uploadedBy,
        size,
        uploadedAt,
        type
      }));
  }

  async get(ownerId: string, fileId: string): Promise<LocalProjectFile> {
    const database = await this.openDatabase();
    const transaction = database.transaction('projectFiles', 'readonly');
    const completed = this.waitForTransaction(transaction);
    const record = await this.requestResult(
      transaction.objectStore('projectFiles').get(fileId)
    );
    await completed;

    if (!record || record.ownerId !== ownerId) {
      throw new Error('This file is not stored for the current account on this browser.');
    }
    return record;
  }

  async save(file: LocalProjectFile): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction('projectFiles', 'readwrite');
    const completed = this.waitForTransaction(transaction);
    transaction.objectStore('projectFiles').put(file);
    await completed;
  }

  async remove(ownerId: string, fileId: string): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction('projectFiles', 'readwrite');
    const completed = this.waitForTransaction(transaction);
    const store = transaction.objectStore('projectFiles');
    const request = store.get(fileId);

    request.onsuccess = () => {
      const record = request.result as LocalProjectFile | undefined;
      if (record?.ownerId === ownerId) store.delete(fileId);
    };
    await completed;
  }

  async removeProjectFiles(ownerId: string, projectId: string): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction('projectFiles', 'readwrite');
    const completed = this.waitForTransaction(transaction);
    const store = transaction.objectStore('projectFiles');
    const request = store.index('ownerId').getAll(ownerId);

    request.onsuccess = () => {
      const records = request.result as LocalProjectFile[];
      records
        .filter(record => record.projectId === projectId)
        .forEach(record => store.delete(record.id));
    };
    await completed;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!globalThis.indexedDB) {
      return Promise.reject(new Error('This browser does not support local file storage.'));
    }
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('spms-local-files', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.createObjectStore('projectFiles', { keyPath: 'id' });
        store.createIndex('ownerId', 'ownerId', { unique: false });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => {
        this.databasePromise = null;
        reject(request.error ?? new Error('Could not open local file storage.'));
      };
      request.onblocked = () => {
        this.databasePromise = null;
        reject(new Error('Local file storage is blocked by another open SPMS tab.'));
      };
    });
    return this.databasePromise;
  }

  private requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Local file operation failed.'));
    });
  }

  private waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Local file operation failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local file operation was cancelled.'));
    });
  }
}
