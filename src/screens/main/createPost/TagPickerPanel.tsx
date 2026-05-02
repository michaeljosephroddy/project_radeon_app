import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Colors,
  Radius,
  Spacing,
  Typography,
} from "../../../theme";

export interface TagCategory {
  label: string;
  tags: string[];
}

interface TagPickerPanelProps {
  categories: TagCategory[];
  customTag: string;
  error: string | null;
  recentTags: string[];
  selectedTags: string[];
  tagCount: number;
  maxTags: number;
  onAddTag: (tag: string) => void;
  onChangeCustomTag: (value: string) => void;
  onClose: () => void;
  onRemoveTag: (tag: string) => void;
  onToggleTag: (tag: string) => void;
}

export function TagPickerPanel({
  categories,
  customTag,
  error,
  recentTags,
  selectedTags,
  tagCount,
  maxTags,
  onAddTag,
  onChangeCustomTag,
  onClose,
  onRemoveTag,
  onToggleTag,
}: TagPickerPanelProps): React.ReactElement {
  const [filter, setFilter] = useState("");

  const filteredCategories = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({ ...c, tags: c.tags.filter((t) => t.includes(q)) }))
      .filter((c) => c.tags.length > 0);
  }, [categories, filter]);

  const filteredRecent = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return recentTags;
    return recentTags.filter((t) => t.includes(q));
  }, [filter, recentTags]);

  const submitCustomTag = (): void => {
    if (customTag.trim()) {
      onAddTag(customTag);
      setFilter("");
    } else if (filter.trim()) {
      onAddTag(filter);
      setFilter("");
    }
  };

  const handleChangeCustom = (value: string): void => {
    onChangeCustomTag(value);
    setFilter(value);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Add a tag</Text>
        <Text style={styles.counter}>
          {tagCount}/{maxTags}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close tag picker"
          hitSlop={8}
        >
          <Text style={styles.doneLink}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputRow}>
        <Text style={styles.hash}>#</Text>
        <TextInput
          style={styles.input}
          value={customTag}
          onChangeText={handleChangeCustom}
          placeholder="search or create"
          placeholderTextColor={Colors.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submitCustomTag}
          blurOnSubmit={false}
          accessibilityLabel="Tag input"
        />
        {customTag.trim().length > 0 ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={submitCustomTag}
            accessibilityRole="button"
            accessibilityLabel="Add tag"
          >
            <Ionicons name="add" size={20} color={Colors.textOn.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {selectedTags.length > 0 ? (
        <View style={styles.selectedSection}>
          <View style={styles.chipRow}>
            {selectedTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.chip, styles.chipSelected]}
                onPress={() => onRemoveTag(tag)}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${tag}`}
              >
                <Text style={[styles.chipText, styles.chipTextSelected]}>
                  #{tag}
                </Text>
                <Ionicons name="close" size={12} color={Colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filteredRecent.length > 0 ? (
          <Section label="Recent">
            <ChipList
              tags={filteredRecent}
              selectedTags={selectedTags}
              onToggle={onToggleTag}
            />
          </Section>
        ) : null}

        {filteredCategories.map((category) => (
          <Section key={category.label} label={category.label}>
            <ChipList
              tags={category.tags}
              selectedTags={selectedTags}
              onToggle={onToggleTag}
            />
          </Section>
        ))}

        {filteredCategories.length === 0 && filteredRecent.length === 0 ? (
          <Text style={styles.empty}>
            No matching tags. Press + to create #{filter.trim()}.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

interface ChipListProps {
  tags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
}

function ChipList({
  tags,
  selectedTags,
  onToggle,
}: ChipListProps): React.ReactElement {
  return (
    <View style={styles.chipRow}>
      {tags.map((tag) => {
        const selected = selectedTags.includes(tag);
        return (
          <TouchableOpacity
            key={tag}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onToggle(tag)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Tag ${tag}`}
          >
            <Text
              style={[styles.chipText, selected && styles.chipTextSelected]}
            >
              #{tag}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    maxHeight: 360,
    backgroundColor: Colors.bg.page,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: Typography.sizes.md,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  counter: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.muted,
    fontWeight: "600",
  },
  doneLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bg.page,
    gap: Spacing.xs,
  },
  hash: {
    color: Colors.text.muted,
    fontSize: Typography.sizes.base,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Typography.sizes.base,
    paddingVertical: 0,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  error: {
    color: Colors.danger,
    fontSize: Typography.sizes.xs,
    paddingHorizontal: Spacing.md + Spacing.md,
    paddingBottom: Spacing.xs,
  },
  selectedSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.muted,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    minHeight: 30,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.bg.page,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  chipText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.sm,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: Colors.primary,
  },
  empty: {
    color: Colors.text.muted,
    fontSize: Typography.sizes.sm,
    paddingVertical: Spacing.md,
    textAlign: "center",
  },
});
