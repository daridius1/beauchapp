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
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  guessesRemaining: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 12,
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
  pickerSection: {
    marginBottom: theme.spacing.md,
  },
  endBanner: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  endBannerLost: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  endBannerTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 4,
  },
  endBannerText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
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
