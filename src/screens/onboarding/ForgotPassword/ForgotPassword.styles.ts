import { Colors } from '@app/styles/colors';
import { SCREEN_HORIZONTAL_MARGIN } from '@app/utilities/constants';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: SCREEN_HORIZONTAL_MARGIN,
  },
  scrollContent: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: SCREEN_HORIZONTAL_MARGIN,
  },
  textTitle: {
    fontWeight: '700',
    fontSize: typeScale.h1.fontSize,
  },
  buttonLogin: {
    marginTop: 16,
  },
});
