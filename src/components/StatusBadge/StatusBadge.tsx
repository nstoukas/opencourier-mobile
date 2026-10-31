import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OrderStatus } from '@app/types/enums';
import { color, ColorName } from '@app/styles/theme';
import { styles } from './StatusBadge.styles';

// `keyof typeof OrderStatus`: the enum's member names ('dropped_off', 'canceled', ...), not its values.
type StatusMember = keyof typeof OrderStatus;

type Tone = { background: ColorName; text: ColorName };

// Each status's colors from the tokens (spec 0007, the badge tone table).
const TONES: Record<StatusMember, Tone> = {
  dropped_off: { background: 'success', text: 'success-foreground' },
  canceled: { background: 'destructive-soft', text: 'destructive' },
  created: { background: 'info-soft', text: 'info' },
  accepted: { background: 'info-soft', text: 'info' },
  dispatched: { background: 'info-soft', text: 'info' },
  courier_arrived_at_pickup_location: { background: 'info-soft', text: 'info' },
  picked_up: { background: 'info-soft', text: 'info' },
  on_the_way: { background: 'info-soft', text: 'info' },
  courier_arrived_at_dropoff_location: {
    background: 'info-soft',
    text: 'info',
  },
};

// The member whose value the API sent (it sends values, such as 'DROPPED_OFF'). Looking the label up
// by member name means a fix to the enum's value changes nothing here.
export function statusMember(status: string): StatusMember | undefined {
  const entry = Object.entries(OrderStatus).find(
    ([, value]) => value === status,
  );
  return entry?.[0] as StatusMember | undefined;
}

type Props = {
  // The status exactly as the courier API sends it.
  status: string;
  style?: StyleProp<ViewStyle>;
};

// A delivery's status as a small colored label. A value the app does not know shows as it came.
export const StatusBadge = ({ status, style }: Props) => {
  const { t } = useTranslation();
  const member = statusMember(status);
  const tone: Tone = member
    ? TONES[member]
    : { background: 'muted', text: 'muted-foreground' };
  const label = member ? t(`translations:status_${member}`) : status;
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: color[tone.background] },
        style,
      ]}>
      <Text
        style={[styles.text, { color: color[tone.text] }]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};
