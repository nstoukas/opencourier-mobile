import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: Colors.black1,
    marginHorizontal: 16,
    borderRadius: radius.xl,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: Colors.white,
  },
  content: {
    flexDirection: 'row',
    paddingVertical: 2,
    alignItems: 'center',
  },
  search: {
    width: 20,
    height: 20,
    marginRight: 8,
    marginVertical: 10,
  },
  textInput: {
    flex: 1,
    // The search field is a control: 48 px tall (spec 0007).
    height: control.xl,
    fontSize: typeScale['body-sm'].fontSize,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
});
