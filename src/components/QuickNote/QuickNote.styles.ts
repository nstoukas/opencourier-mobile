import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    borderRadius: radius['2xl'],
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.gray4,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: typeScale.caption.fontSize,
    color: Colors.black1,
    fontWeight: '600',
  },
});
