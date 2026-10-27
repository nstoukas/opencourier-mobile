import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray8,
    borderRadius: radius['2xl'],
    padding: 4,
  },
  button: {
    borderRadius: radius['2xl'],
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray8,
    flex: 1,
  },
  text: {
    fontWeight: '600',
    fontSize: typeScale['body-sm'].fontSize,
    lineHeight: typeScale['body-sm'].lineHeight,
    color: Colors.black6,
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
    backgroundColor: Colors.gray21,
  },
});
