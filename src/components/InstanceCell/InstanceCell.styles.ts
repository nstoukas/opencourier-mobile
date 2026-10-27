import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 28,
    height: 26,
  },
  containerText: {
    marginLeft: 6,
    marginVertical: 8,
  },
  textName: {
    fontWeight: '600',
    fontSize: typeScale.caption.fontSize,
    color: Colors.black1,
    lineHeight: typeScale.caption.lineHeight,
  },
  textLink: {
    fontWeight: '600',
    fontSize: typeScale.caption.fontSize,
    color: Colors.black5,
    lineHeight: typeScale.caption.lineHeight,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray7,
  },
});
