import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  containerMap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  containerAway: {
    flex: 1,
  },
  containerTextAway: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textDistance: {
    fontSize: typeScale.body.fontSize,
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
});
