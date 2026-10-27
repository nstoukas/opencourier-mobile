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
  scrollContent: {
    justifyContent: 'center',
    flex: 1,
  },
  content: {
    borderRadius: radius.lg,
    backgroundColor: Colors.white,
    padding: 8,
  },
  header: {
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: typeScale.h3.fontSize,
    fontWeight: '600',
    color: Colors.black1,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.gray1,
    minHeight: 100,
    borderRadius: radius.xl,
    padding: 10,
    marginBottom: 4,
    marginHorizontal: 8,
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
  },
  iconinfo: {
    marginRight: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
