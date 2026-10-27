import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: Colors.gray4,
    borderRadius: radius.sm,
    marginVertical: 5,
    paddingVertical: 2,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  icon: {
    width: 16,
    height: 16,
  },
  text: {
    fontWeight: '500',
    fontSize: typeScale['body-sm'].fontSize,
    marginLeft: 5,
  },
});
