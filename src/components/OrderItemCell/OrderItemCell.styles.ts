import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 10,
    marginTop: 22,
  },
  text: {
    fontWeight: '500',
    fontSize: typeScale['body-sm'].fontSize,
    marginLeft: 8,
    color: Colors.gray11,
    flex: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  separator: { height: 1, backgroundColor: Colors.gray22 },
});
