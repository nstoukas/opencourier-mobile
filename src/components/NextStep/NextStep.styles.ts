import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { color, control, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  blueSeparator: {
    height: 3,
    backgroundColor: Colors.blue4,
    flex: 1,
    marginBottom: 16,
  },
  nextStep: {
    backgroundColor: Colors.blue5,
    paddingBottom: 12,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 12,
  },
  textNextStep: {
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 8,
  },
  cell: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginVertical: 10,
  },
  cellText: {
    flex: 1,
    marginLeft: 8,
  },
  cellName: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
  },
  cellItems: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
  },
  // "Waiting to send": a step tapped with no signal (spec 0009).
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: color['warning-soft'],
  },
  waitingText: {
    marginLeft: 8,
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    color: color.foreground,
  },
});
