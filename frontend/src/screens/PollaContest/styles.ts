import { StyleSheet, Platform } from 'react-native';
import { theme } from '../HomeScreen';

export const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg * 3,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  backBtn: {
    alignSelf: 'center',
  },
  backBtnText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  adminToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.cardBg,
  },
  adminToggleBtnActive: {
    borderColor: '#e11d48', // Red for admin mode active
    backgroundColor: 'rgba(225, 29, 72, 0.05)',
  },
  adminToggleBtnText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  adminToggleBtnTextActive: {
    color: '#e11d48',
  },
  titleSection: {
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  rulesContainer: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  rulesToggle: {
    marginTop: theme.spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.cardBg,
    alignSelf: 'flex-start',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rulesToggleText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  rulesHeader: {
    paddingVertical: 2,
  },
  rulesHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  rulesContent: {
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  rulesText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
  rulesBold: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  ruleItem: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
  ruleHighlight: {
    color: theme.colors.accent,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingBottom: 4,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  activeTabText: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  tabButtonActive: {
    // Estilo activo simplificado (se maneja con color de texto para minimalismo)
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  tabButtonTextActive: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
  errorBanner: {
    padding: theme.spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  successBanner: {
    padding: theme.spacing.md,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  successText: {
    color: '#22c55e',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  stageSection: {
    marginBottom: theme.spacing.xl,
  },
  stageHeader: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  stageHeaderText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  matchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matchCard: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  matchDate: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewBetsLink: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'center',
  },
  viewBetsText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  teamContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamHome: {
    justifyContent: 'flex-start',
  },
  teamAway: {
    justifyContent: 'flex-end',
  },
  flagEmoji: {
    fontSize: 20,
    marginHorizontal: theme.spacing.sm,
  },
  teamName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  scoreInputsContainer: {
    width: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreInput: {
    width: 38,
    height: 34,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.text,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  scoreDivider: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: theme.spacing.xs,
  },
  playedScoresContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playedScoreText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  playedToggle: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.cardBg,
    alignSelf: 'flex-start',
  },
  playedToggleActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
  },
  playedToggleText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  playedToggleTextActive: {
    color: '#22c55e',
  },
  infoBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  officialBadge: {
    backgroundColor: 'rgba(38, 166, 154, 0.1)',
    borderColor: 'rgba(38, 166, 154, 0.2)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: theme.spacing.sm,
  },
  officialBadgeText: {
    color: '#26a69a',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  predResultText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  predSavedIndicator: {
    alignSelf: 'center',
  },
  predSavedText: {
    fontSize: 10,
    color: '#22c55e',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  participantsSection: {
    marginTop: theme.spacing.xs,
  },
  leaderboardList: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  rankGold: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: '#eab308',
  },
  rankSilver: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: '#94a3b8',
  },
  rankBronze: {
    backgroundColor: 'rgba(180, 83, 9, 0.15)',
    borderColor: '#b45309',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  rankTextPodium: {
    color: theme.colors.text,
  },
  leaderboardInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  participantEmail: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  pointsContainer: {
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  pointsSubText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },

  // Estilos adicionales para la sección de Administración 1 a 1
  adminSection: {
    marginTop: theme.spacing.xs,
  },
  adminMatchContainer: {
    marginBottom: theme.spacing.md,
  },
  adminMatchRow: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  adminMatchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  adminMatchTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamAlignRight: {
    justifyContent: 'flex-end',
  },
  adminTeamName: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text,
    flexShrink: 1,
  },
  adminScoreText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.accent,
    width: 60,
    textAlign: 'center',
  },
  adminMatchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  statusBadgePlayed: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadgeTextPlayed: {
    color: '#22c55e',
  },
  statusBadgeTextPending: {
    color: theme.colors.textMuted,
  },
  modifyBtn: {
    backgroundColor: '#111111',
    borderColor: '#222222',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  modifyBtnText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },

  // Tarjeta de Edición de Partido
  editCard: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.text, // Solid border for editing card in B/W theme
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  editCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.accent,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  editTeamCol: {
    flex: 1,
    alignItems: 'center',
  },
  editTeamName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 4,
    textAlign: 'center',
    width: '100%',
  },
  editInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },
  editScoreInput: {
    width: 38,
    height: 38,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    padding: 0,
  },
  editScoreDivider: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: theme.spacing.xs,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.4)',
    paddingTop: theme.spacing.md,
  },
  editButtonsRow: {
    flexDirection: 'row',
  },
  cancelEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
  },
  cancelEditBtnText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  saveEditBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveEditBtnText: {
    color: '#000000', // Black text on white button
    fontSize: 12,
    fontWeight: '700',
  },

  // --- Estilos: Cabecera del panel admin y creación de partidos ---
  adminPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  adminPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as any,
  newMatchBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  newMatchBtnActive: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  newMatchBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  newMatchBtnTextActive: {
    color: '#ef4444',
  },
  createMatchCard: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  createMatchTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
  },
  createMatchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  stageChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.xs,
  } as any,
  stageChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
  },
  stageChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: '#111111',
  },
  stageChipText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  stageChipTextActive: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
  createInput: {
    height: 38,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 2,
  },
  teamInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  } as any,
  flagInput: {
    width: 52,
    textAlign: 'center',
    fontSize: 18,
  },
  teamNameInput: {
    flex: 1,
  },
  createMatchSubmitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  createMatchSubmitBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },
  matchTagBadge: {
    backgroundColor: '#333',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  matchTagBadgeText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
  },
});
