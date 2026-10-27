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
  title: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typeScale.body.fontSize,
    textAlign: 'center',
  },
});
