import { Keyboard } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';

const KEYBOARD_SETTLE_MS = 40;

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function dismissKeyboardBeforeNavigation(): Promise<void> {
    if (!KeyboardController.isVisible()) {
        Keyboard.dismiss();
        return;
    }

    try {
        await KeyboardController.dismiss({ keepFocus: false, animated: true });
    } catch {
        Keyboard.dismiss();
    }

    await wait(KEYBOARD_SETTLE_MS);
}

export function runAfterKeyboardDismiss(action: () => void): void {
    void (async (): Promise<void> => {
        await dismissKeyboardBeforeNavigation();
        action();
    })();
}
