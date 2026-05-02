import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../../components/Avatar";
import { Colors, Spacing, Typography } from "../../../theme";
import { formatUsername } from "../../../utils/identity";

interface AuthorPillProps {
  username: string;
  avatarUrl?: string;
}

export function AuthorPill({
  username,
  avatarUrl,
}: AuthorPillProps): React.ReactElement {
  return (
    <View style={styles.row}>
      <Avatar username={username} avatarUrl={avatarUrl} size={28} fontSize={11} />
      <Text style={styles.handle} numberOfLines={1}>
        {formatUsername(username)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  handle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.sm,
    fontWeight: "600",
  },
});
