import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

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
    height: 40,
    fontSize: typeScale['body-sm'].fontSize,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
});
