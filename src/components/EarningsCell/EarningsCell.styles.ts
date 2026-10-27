import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  containerText: {
    flex: 1,
    marginRight: 12,
  },
  textDay: {
    fontWeight: '700',
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
  },
  // Date and delivery count, quieter than the weekday above it.
  textDetail: {
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.gray13,
    marginTop: 2,
  },
  textEarned: {
    fontSize: typeScale.h3.fontSize,
    fontWeight: '700',
    color: Colors.black1,
  },
  iconArrow: {
    width: 24,
    height: 24,
    marginLeft: 8,
  },
});
