import { Alert as RNAlert, Platform } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Universal cross-platform Alert replacement.
 * React Native Web's default Alert.alert() is an empty no-op function (`static alert() {}`).
 * This utility detects Web and triggers standard browser confirmation/alert dialogs
 * so callbacks (like `onPress`) are actually executed.
 */
export const OpsklAlert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    if (Platform.OS === 'web') {
      const formattedText = message ? `${title}\n\n${message}` : title;
      
      // If no buttons, or 1 button (acknowledgement)
      if (!buttons || buttons.length <= 1) {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(formattedText);
        }
        if (buttons && buttons[0]?.onPress) {
          buttons[0].onPress();
        }
        return;
      }

      // If multi-button dialog (e.g. Cancel + Confirm)
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];

      let confirmed = false;
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        confirmed = window.confirm(formattedText);
      } else {
        confirmed = true;
      }

      if (confirmed) {
        if (actionBtn?.onPress) {
          actionBtn.onPress();
        }
      } else {
        if (cancelBtn?.onPress) {
          cancelBtn.onPress();
        }
      }
      return;
    }

    // Native iOS/Android fallback
    RNAlert.alert(title, message, buttons);
  },
};
