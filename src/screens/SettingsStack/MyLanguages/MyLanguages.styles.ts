import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  title: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 16,
  },
  list: {
    paddingHorizontal: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.gray9,
    borderRadius: radius['2xl'],
    padding: 24,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 40,
  },
  image: {
    width: 24,
    height: 24,
    marginRight: 16,
  },
  cardTitle: {
    fontWeight: '700',
    lineHeight: typeScale.body.lineHeight,
    flex: 1,
    fontSize: typeScale.body.fontSize,
  },
  cardText: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: Colors.black6,
    marginTop: 4,
    marginBottom: 16,
    marginLeft: 40,
    marginRight: 40,
    lineHeight: typeScale['body-sm'].lineHeight,
  },
});
