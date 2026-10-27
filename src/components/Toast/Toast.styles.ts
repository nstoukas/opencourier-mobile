import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    marginHorizontal: 16,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 3,
    flexDirection: 'row',
    marginVertical: 2,
  },
  containerLoader: {
    width: 21,
    height: 21,
    borderRadius: radius.sm,
    backgroundColor: Colors.white,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
    lineHeight: typeScale.body.lineHeight,
    flex: 1,
    fontWeight: '500',
  },
  buttonClose: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    flexDirection: 'row',
  },
  buttonEnable: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  checkmark: {
    width: 13,
    height: 13,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: Colors.gray9,
    marginRight: 8,
  },
  textEnable: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '700',
    color: Colors.black1,
    lineHeight: typeScale['body-sm'].lineHeight,
  },
});
