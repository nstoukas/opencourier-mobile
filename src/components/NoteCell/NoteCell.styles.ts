import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    marginVertical: 5,
    paddingVertical: 2,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  text: {
    fontSize: typeScale.body.fontSize,
    marginLeft: 5,
  },
});
