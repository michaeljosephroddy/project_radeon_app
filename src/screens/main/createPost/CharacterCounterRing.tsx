import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, TextStyles } from "../../../theme";

interface CharacterCounterRingProps {
  count: number;
  max: number;
}

const SHOW_THRESHOLD = 0.8;

export function CharacterCounterRing({
  count,
  max,
}: CharacterCounterRingProps): React.ReactElement | null {
  const ratio = count / max;
  if (ratio < SHOW_THRESHOLD) return null;

  const remaining = max - count;
  const tone = remaining < 0 ? "danger" : remaining <= 20 ? "warn" : "info";

  return (
    <View
      style={[
        styles.ring,
        tone === "warn" && styles.ringWarn,
        tone === "danger" && styles.ringDanger,
      ]}
      accessibilityLabel={`${remaining} characters remaining`}
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[
          styles.count,
          tone === "warn" && styles.countWarn,
          tone === "danger" && styles.countDanger,
        ]}
      >
        {remaining}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: Colors.info,
    alignItems: "center",
    justifyContent: "center",
  },
  ringWarn: {
    borderColor: Colors.warning,
  },
  ringDanger: {
    borderColor: Colors.danger,
  },
  count: {
    ...TextStyles.caption,
    color: Colors.text.secondary,
    fontWeight: "700",
  },
  countWarn: {
    color: Colors.warning,
  },
  countDanger: {
    color: Colors.danger,
  },
});
