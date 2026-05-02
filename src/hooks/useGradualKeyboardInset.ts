import { useKeyboardHandler } from "react-native-keyboard-controller";
import {
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

interface UseGradualKeyboardInsetOptions {
  closedHeight: number;
  openedOffset: number;
}

interface UseGradualKeyboardInsetResult {
  height: SharedValue<number>;
}

export function useGradualKeyboardInset({
  closedHeight,
  openedOffset,
}: UseGradualKeyboardInsetOptions): UseGradualKeyboardInsetResult {
  const height = useSharedValue(closedHeight);

  useKeyboardHandler(
    {
      onMove: (event) => {
        "worklet";
        const cushion =
          closedHeight + (openedOffset - closedHeight) * event.progress;
        height.value = event.height + cushion;
      },
      onInteractive: (event) => {
        "worklet";
        const cushion =
          closedHeight + (openedOffset - closedHeight) * event.progress;
        height.value = event.height + cushion;
      },
      onEnd: (event) => {
        "worklet";
        const cushion =
          closedHeight + (openedOffset - closedHeight) * event.progress;
        height.value = event.height + cushion;
      },
    },
    [closedHeight, openedOffset],
  );

  return { height };
}
