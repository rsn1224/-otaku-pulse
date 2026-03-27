import { vi } from 'vitest';

export const sendNotification = vi.fn();
export const isPermissionGranted = vi.fn().mockResolvedValue(true);
export const requestPermission = vi.fn().mockResolvedValue('granted');
