import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  containerProfile: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 16,
  },
  // Row 47 live check: the greeting wraps instead of running off the menu's edge
  // ("Γεια σας" is longer than "Hi", and so is many a name).
  textName: {
    flexShrink: 1,
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    marginLeft: 8,
    color: Colors.black,
  },
  separator: {
    height: 2,
    backgroundColor: Colors.gray1,
    marginVertical: 8,
  },
  cell: {
    marginVertical: 8,
  },
});
