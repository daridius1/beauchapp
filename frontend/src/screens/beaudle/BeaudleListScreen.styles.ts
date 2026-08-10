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
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
  },
  streakRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
  },
  streakValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  streakLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayRowLast: {
    borderBottomWidth: 0,
  },
  dayInfo: {
    flex: 1,
    minWidth: 0,
  },
  dayTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  dayDate: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  dayStatus: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  dayStatusWon: {
    color: '#22c55e',
  },
  dayStatusLost: {
    color: theme.colors.error,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  loadMoreBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
