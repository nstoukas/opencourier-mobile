import { Colors } from '@app/styles/colors';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageSmall: {
    width: 180,
    height: 180,
  },
  imageBIg: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
  },
  title: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    color: Colors.black,
  },
  subtitle: {
    margin: 24,
    fontSize: typeScale.body.fontSize,
    color: Colors.black,
    textAlign: 'center',
  },
});
