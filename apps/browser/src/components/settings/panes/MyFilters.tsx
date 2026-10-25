import { getUserFilters, setUserFilters } from "@ardia/ardiacore";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { Button, Sheet, useFormColors } from "../controls";
import { closeSettingsSheet } from "../sheet";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function MyFiltersSheet({ onSaved }: { onSaved?: () => void }) {
  const theme = useTheme();
  const colors = useFormColors();
  const [text, setText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getUserFilters().then(
      (filters) => live && setText(filters),
      (e) => {
        if (!live) return;
        setText("");
        setError(`Couldn't read your filters: ${errorText(e)}`);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    if (text === null) return;
    setSaving(true);
    setError(null);
    try {
      await setUserFilters(text);
      onSaved?.();
      closeSettingsSheet();
    } catch (e) {
      setError(`Couldn't save your filters: ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet width={560} onClose={closeSettingsSheet}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>My Filters</Text>
      <Text style={{ fontSize: 12, marginTop: 4, color: theme.textSecondary }}>
        One rule per line, in uBlock Origin syntax. Example: example.com##.sponsored
      </Text>
      <View
        style={{
          marginTop: 12,
          height: 260,
          borderRadius: 7,
          padding: 8,
          backgroundColor: colors.field,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: error ? colors.destructive : colors.fieldBorder,
        }}
      >
        <TextInput
          value={text ?? ""}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          editable={text !== null}
          multiline
          autoFocus
          placeholder={text === null ? "Loading…" : "example.com##.sponsored"}
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.selection}
          enableFocusRing={false}
          autoCorrect={false}
          spellCheck={false}
          style={{ flex: 1, fontSize: 12, lineHeight: 17, color: theme.textPrimary, fontFamily: "Menlo" }}
        />
      </View>
      {error ? <Text style={{ marginTop: 6, fontSize: 11.5, lineHeight: 15, color: colors.destructive }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button title="Cancel" onPress={closeSettingsSheet} />
        <Button title={saving ? "Saving…" : "Save"} kind="primary" disabled={saving || text === null} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}
