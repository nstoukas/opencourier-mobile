import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
  },
  containerImage: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: Colors.gray1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  // Wider than the circle so its caption size words fit on one line (spec 0007).
  containerStatus: {
    position: 'absolute',
    bottom: -4,
    left: -12,
    right: -12,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.white,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.red1,
  },
  textStatus: {
    fontWeight: '700',
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    // Android adds space above and below text by default; without it the words sit centered.
    includeFontPadding: false,
    color: Colors.white,
  },
  statusIndicatorSmall: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: Colors.white,
    borderRadius: radius.full,
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
});
