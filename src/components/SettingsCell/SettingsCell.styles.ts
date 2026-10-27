import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerVerticalText: {
    marginRight: 12,
    flex: 1,
  },
  textTitle: {
    fontWeight: '600',
    fontSize: typeScale['body-sm'].fontSize,
    lineHeight: typeScale['body-sm'].lineHeight,
    color: Colors.black,
  },
  imageArrowRight: {
    width: 24,
    height: 24,
  },
  textSubtitle: {
    fontWeight: '500',
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    color: Colors.blackAlpha05,
  },
  imageRadioButton: {
    width: 20,
    height: 20,
    marginTop: 3,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray22,
    marginTop: 8,
  },
});
