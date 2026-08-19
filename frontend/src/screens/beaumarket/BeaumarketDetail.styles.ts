import { StyleSheet } from 'react-native';
import { theme } from '../../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
  },
  commentsSection: {
    marginTop: 0,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
