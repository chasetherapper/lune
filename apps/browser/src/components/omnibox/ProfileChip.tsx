import { Symbol } from "@ardia/shell";
import { Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { useIsIncognito, useWindowProfile } from "../../store/hooks";
import { ProfileBadge } from "../profiles/icons";

const BADGE = 14;

export function ProfileChip() {
  const theme = useTheme();
  const incognito = useIsIncognito();
  const profile = useWindowProfile();
  return (
    <View
      style={{
        height: 26,
        borderRadius: 8,
        paddingLeft: 7,
        paddingRight: 9,
        gap: 6,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.commandBarChip,
      }}
    >
      {incognito ? (
        <Symbol name="eyeglasses" size={11} weight="semibold" color={theme.textSecondary} style={{ width: BADGE, height: BADGE }} />
      ) : (
        <ProfileBadge profile={profile} size={BADGE} />
      )}
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "500", color: theme.textSecondary, maxWidth: 160 }}>
        {incognito ? "Incognito" : profile.name}
      </Text>
    </View>
  );
}
