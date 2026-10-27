import { Colors } from '@app/styles/colors';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

const TOTAL_HORIZONTAL_SPACING = 144;

export const styles = StyleSheet.create({
  container: {
    // paddingHorizontal: 16,
    flexDirection: 'row',
  },
  tabs: {
    width: SCREEN_WIDTH - TOTAL_HORIZONTAL_SPACING,
    flexDirection: 'row',
    padding: 4,
    backgroundColor: Colors.gray8,
    justifyContent: 'space-between',
    height: 40,
    alignItems: 'center',
    borderRadius: radius.xl,
  },
  textTab: {
    fontWeight: '700',
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    alignSelf: 'center',
  },
  containerTabText: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: radius.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
    height: 32,
    alignItems: 'center',
  },
  containerCount: {
    height: 16,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.red1,
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  textCount: {
    fontWeight: '900',
    fontSize: typeScale.caption.fontSize,
    color: Colors.white,
  },
});
