import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 34,
    height: 40,
    margin: 10,
  },
  text: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    color: Colors.black,
  },
  containerDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdown: {
    marginLeft: 4,
  },
});
