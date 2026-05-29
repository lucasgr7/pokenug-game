export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
	id: string;
	message: string;
	kind: ToastKind;
}

export const toasts = $state<{ list: Toast[] }>({ list: [] });

export function pushToast(message: string, kind: ToastKind = 'info', durationMs = 3000): void {
	const id = crypto.randomUUID();
	toasts.list.push({ id, message, kind });
	setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: string): void {
	toasts.list = toasts.list.filter((t) => t.id !== id);
}
