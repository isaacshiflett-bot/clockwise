import {LocalStorageAdapter} from './localStorage';
import type {StorageAdapter} from './types';
export const storage:StorageAdapter=new LocalStorageAdapter();
