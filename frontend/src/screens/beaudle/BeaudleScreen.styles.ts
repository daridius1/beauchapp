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
    marginBottom: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  guessesRemaining: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: theme.spacing.xs,
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
});
