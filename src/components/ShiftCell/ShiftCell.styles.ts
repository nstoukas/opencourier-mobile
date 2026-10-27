import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  content: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textTitle: {
    fontWeight: '600',
    fontSize: typeScale.h3.fontSize,
    lineHeight: typeScale.h3.lineHeight,
    color: Colors.black,
    marginLeft: 12,
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
  line: {
    height: 1,
    backgroundColor: Colors.black,
    alignSelf: 'stretch',
    flex: 1,
  },
  containerRanges: {
    paddingTop: 10,
  },
  containerShift: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  textTime: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    padding: 8,
    borderColor: Colors.green5,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  buttonDeleteAdd: {
    width: 30,
    height: 24,
    borderWidth: 1,
    borderColor: Colors.gray9,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTrash: {
    width: 14,
    height: 14,
    tintColor: Colors.black1,
  },
});
