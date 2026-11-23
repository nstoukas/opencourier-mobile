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
  // Row 47 live check: a wide, empty row under the avatar that holds the word, so the
  // word is measured against this row and not against the 40 wide avatar. Without it the
  // Greek "Σε σύνδεση" or "Τελευταία παραγγελία" was cut to "Σ…".
  statusRow: {
    position: 'absolute',
    bottom: -4,
    left: -12,
    width: 240,
    alignItems: 'flex-start',
  },
  // Wider and taller than the avatar so its caption size word fits on one line (spec 0007);
  // never narrower than before, and as wide as a longer word needs (it grows to the right).
  containerStatus: {
    minWidth: 64,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.white,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStatus: {
    fontWeight: '700',
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    // Android adds space above and below text by default; without it the word sits centered.
    includeFontPadding: false,
    textAlign: 'center',
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
