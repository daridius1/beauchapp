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
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceValue: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '800',
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  marketRowMain: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusOpen: { color: '#22c55e' },
  statusClosed: { color: '#facc15' },
  statusResolved: { color: '#38bdf8' },
  statusCancelled: { color: '#ef4444' },
  marketTitle: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  marketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  marketMetaText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  marketMetaDivider: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginHorizontal: 6,
  },
  marketMetaAccent: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
