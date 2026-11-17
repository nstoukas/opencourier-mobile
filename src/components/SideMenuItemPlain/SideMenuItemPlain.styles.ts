import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { color, control, typeScale, radius } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    marginHorizontal: 15,
    fontSize: typeScale['body-sm'].fontSize,
    flex: 1,
    color: Colors.black,
  },
  // The chat's unread dot (spec 0034, AC-12).
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: color.destructive,
  },
});
