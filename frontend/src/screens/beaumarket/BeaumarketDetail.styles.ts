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
  commentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  quoteHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quoteHeaderBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
