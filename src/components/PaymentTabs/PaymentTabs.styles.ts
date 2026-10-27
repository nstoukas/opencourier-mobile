import { Colors } from '@app/styles/colors';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

const TOTAL_HORIZONTAL_SPACING = 32;

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  tabs: {
    width: SCREEN_WIDTH - TOTAL_HORIZONTAL_SPACING,
    flexDirection: 'row',
  },
  tab: {
    width: (SCREEN_WIDTH - TOTAL_HORIZONTAL_SPACING) / 2,
  },
  indicator: {
    width: (SCREEN_WIDTH - TOTAL_HORIZONTAL_SPACING) / 2,
    height: 4,
    backgroundColor: Colors.black1,
    marginTop: 12,
    marginBottom: 2,
  },
  textTab: {
    fontWeight: '700',
    fontSize: typeScale.h3.fontSize,
    alignSelf: 'center',
  },
  containerTabText: {
    flexDirection: 'row',
    alignSelf: 'center',
  },
  containerCount: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  textCount: {
    fontWeight: '900',
    fontSize: typeScale.caption.fontSize,
    color: Colors.white,
  },
});
