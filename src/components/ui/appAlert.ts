export interface AppAlertButton {
    text?: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertOptions {
    cancelable?: boolean;
    onDismiss?: () => void;
}

export interface AppAlertPayload {
    title: string;
    message?: string;
    buttons?: AppAlertButton[];
    options?: AppAlertOptions;
}

type AlertHandler = (payload: AppAlertPayload) => void;

let activeAlertHandler: AlertHandler | null = null;

export function bindAppAlertHandler(handler: AlertHandler): () => void {
    activeAlertHandler = handler;
    return () => {
        if (activeAlertHandler === handler) {
            activeAlertHandler = null;
        }
    };
}

export const appAlert = {
    alert(title: string, message?: string, buttons?: AppAlertButton[], options?: AppAlertOptions): void {
        if (activeAlertHandler) {
            activeAlertHandler({ title, message, buttons, options });
            return;
        }
        // Keep failures visible in dev if the provider is not mounted yet.
        console.warn('appAlert called without mounted AppPopupProvider', { title, message });
    },
};
