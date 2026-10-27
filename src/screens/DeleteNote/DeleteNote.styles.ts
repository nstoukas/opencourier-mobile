import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.transparentModalBackground,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    borderRadius: radius.lg,
    backgroundColor: Colors.white,
    padding: 8,
  },
  header: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
    color: Colors.black1,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray8,
    marginBottom: 8,
  },
  containerInfo: {
    flexDirection: 'row',
    marginVertical: 2,
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: 8,
  },
  textInfo: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    lineHeight: typeScale.caption.lineHeight,
    color: Colors.red1,
  },
  iconinfo: {
    marginRight: 2,
    tintColor: Colors.red1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
