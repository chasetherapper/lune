import { fuzzyScore } from "@ardia/core";
import { Symbol } from "@ardia/shell";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { APP_NAME } from "../../lib/appName";
import { useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { useShallow } from "zustand/react/shallow";
import type { Profile } from "../../store/types";
import { PANEL, Popover, PopoverSeparator, usePopoverPresence } from "../layout/controls";
import { useHover } from "../primitives";
import { ProfileBadge } from "../profiles/icons";
import { littleArdiaProfile, openInMainWindow, openInProfile } from "./actions";

const HEIGHT = 28;
const RADIUS = 7;
const CHEVRON_WIDTH = 22;
const PICKER_WIDTH = 248;
const SEARCH_HEIGHT = 36;
const NAME_MAX_WIDTH = 150;

const useProfiles = () => useBrowser(useShallow((s) => s.profileOrder.map((id) => s.profiles[id]).filter((p): p is Profile => !!p)));

function useCurrentProfile(windowId: string): Profile | undefined {
  return useBrowser((s) => {
    const id = littleArdiaProfile(s, windowId);
    return id ? s.profiles[id] : undefined;
  });
}

function Keycap({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ height: 16, paddingHorizontal: 4, borderRadius: 4, borderWidth: 0.5, borderColor: theme.chipBorder, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 10.5, lineHeight: 13, fontWeight: "500", color: theme.textTertiary }}>{label}</Text>
    </View>
  );
}

function Segment({ onPress, tooltip, children, left, right }: { onPress: () => void; tooltip: string; children: ReactNode; left: boolean; right: boolean }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <View tooltip={tooltip} {...hoverProps}>
      <Pressable onPress={onPress} accessibilityLabel={tooltip}>
        {({ pressed }) => (
          <View
            style={{
              height: HEIGHT,
              flexDirection: "row",
              alignItems: "center",
              borderTopLeftRadius: left ? RADIUS : 0,
              borderBottomLeftRadius: left ? RADIUS : 0,
              borderTopRightRadius: right ? RADIUS : 0,
              borderBottomRightRadius: right ? RADIUS : 0,
              backgroundColor: pressed ? theme.toolbarPressed : hovered ? theme.toolbarHover : undefined,
            }}
          >
            {children}
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function OpenInButton({ windowId, compact, pickerOpen, onTogglePicker }: { windowId: string; compact: boolean; pickerOpen: boolean; onTogglePicker: () => void }) {
  const theme = useTheme();
  const profile = useCurrentProfile(windowId);
  const several = useBrowser((s) => s.profileOrder.length > 1);
  const name = several && profile ? profile.name : APP_NAME;
  const tooltip = `Open in ${name} (⌘O)`;
  return (
    <View mouseDownCanMoveWindow={false} style={{ flexDirection: "row", alignItems: "center", height: HEIGHT, borderRadius: RADIUS, backgroundColor: pickerOpen ? theme.toolbarHover : theme.urlPill }}>
      <Segment onPress={() => openInMainWindow(windowId)} tooltip={tooltip} left right={!several}>
        {compact ? (
          <View style={{ width: HEIGHT, alignItems: "center", justifyContent: "center" }}>
            {several && profile ? (
              <ProfileBadge profile={profile} size={16} />
            ) : (
              <Symbol name="arrow.up.left.and.arrow.down.right" size={13} color={theme.icon} style={{ width: HEIGHT, height: HEIGHT }} />
            )}
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 9, paddingRight: several ? 7 : 6, gap: 6 }}>
            <Text style={{ fontSize: 12.5, color: theme.textSecondary }}>Open in</Text>
            {several && profile ? <ProfileBadge profile={profile} size={14} /> : null}
            <Text numberOfLines={1} style={{ maxWidth: NAME_MAX_WIDTH, fontSize: 12.5, fontWeight: "600", color: theme.textPrimary }}>
              {name}
            </Text>
            <Keycap label="⌘O" />
          </View>
        )}
      </Segment>
      {several ? (
        <>
          <View style={{ width: 0.5, height: 14, backgroundColor: theme.divider }} />
          <Segment onPress={onTogglePicker} tooltip="Open in Another Profile" left={false} right>
            <Symbol name="chevron.down" size={9} weight="semibold" color={theme.icon} style={{ width: CHEVRON_WIDTH, height: HEIGHT }} />
          </Segment>
        </>
      ) : null}
    </View>
  );
}

export function ProfilePicker({ windowId, open, top, right, onClose }: { windowId: string; open: boolean; top: number; right: number; onClose: () => void }) {
  const { shown, closing, onClosed } = usePopoverPresence(open);
  if (!shown) return null;
  return (
    <Popover width={PICKER_WIDTH} top={top} right={right} onDismiss={onClose} closing={closing} onClosed={onClosed}>
      <PickerContent windowId={windowId} onClose={onClose} />
    </Popover>
  );
}

function PickerContent({ windowId, onClose }: { windowId: string; onClose: () => void }) {
  const theme = useTheme();
  const profiles = useProfiles();
  const current = useCurrentProfile(windowId)?.id;
  const [query, setQuery] = useState("");
  const field = useRef<TextInput>(null);
  const focused = useRef(false);
  const rows = useMemo(() => {
    const q = query.trim();
    if (!q) return profiles;
    return profiles
      .map((p) => ({ p, score: fuzzyScore(q, p.name) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [profiles, query]);
  const [selected, setSelected] = useState(() => Math.max(0, profiles.findIndex((p) => p.id === current)));
  const pick = (profile: Profile | undefined) => {
    if (!profile) return;
    onClose();
    openInProfile(windowId, profile.id);
  };
  const move = (delta: number) => setSelected((i) => (rows.length ? (i + delta + rows.length) % rows.length : 0));

  return (
    <View style={{ paddingBottom: PANEL.rowInset }}>
      <View style={{ height: SEARCH_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: PANEL.rowInset + PANEL.rowPadding, gap: PANEL.iconGap }}>
        <Symbol name="magnifyingglass" size={12} weight="medium" color={theme.textSecondary} style={{ width: PANEL.iconSlot, height: PANEL.iconSlot }} />
        <TextInput
          ref={field}
          onLayout={() => {
            if (focused.current) return;
            focused.current = true;
            field.current?.focus();
          }}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSelected(0);
          }}
          placeholder="Search Profiles…"
          placeholderTextColor={theme.placeholder}
          selectionColor={theme.selection}
          enableFocusRing={false}
          onSubmitEditing={() => pick(rows[selected])}
          keyDownEvents={[{ key: "Escape" }, { key: "ArrowUp" }, { key: "ArrowDown" }]}
          onKeyDown={(e) => {
            const key = e.nativeEvent.key;
            if (key === "Escape") onClose();
            if (key === "ArrowDown") move(1);
            if (key === "ArrowUp") move(-1);
          }}
          style={{ flex: 1, fontSize: PANEL.titleSize, color: theme.textPrimary, paddingVertical: 0 }}
        />
      </View>
      <PopoverSeparator />
      {rows.length === 0 ? (
        <Text style={{ paddingHorizontal: PANEL.inset, paddingVertical: 8, fontSize: PANEL.valueSize, color: theme.textTertiary }}>No profiles match “{query.trim()}”</Text>
      ) : (
        rows.map((profile, i) => (
          <ProfileRow key={profile.id} profile={profile} current={profile.id === current} selected={i === selected} onHover={() => setSelected(i)} onPress={() => pick(profile)} />
        ))
      )}
    </View>
  );
}

function ProfileRow({ profile, current, selected, onHover, onPress }: { profile: Profile; current: boolean; selected: boolean; onHover: () => void; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          onMouseEnter={onHover}
          style={{
            height: PANEL.rowHeight,
            marginHorizontal: PANEL.rowInset,
            paddingHorizontal: PANEL.rowPadding,
            borderRadius: PANEL.rowRadius,
            flexDirection: "row",
            alignItems: "center",
            gap: PANEL.iconGap,
            backgroundColor: pressed ? theme.toolbarPressed : selected ? theme.commandBarSelected : undefined,
          }}
        >
          <View style={{ width: PANEL.iconSlot, height: PANEL.iconSlot, alignItems: "center", justifyContent: "center" }}>
            <ProfileBadge profile={profile} size={18} />
          </View>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: PANEL.titleSize, fontWeight: current ? "600" : "400", color: theme.textPrimary }}>
            {profile.name}
          </Text>
          {current ? <Symbol name="checkmark" size={11} weight="semibold" color={theme.textSecondary} style={{ width: 16, height: 16 }} /> : null}
        </View>
      )}
    </Pressable>
  );
}
