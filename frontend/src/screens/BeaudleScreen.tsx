import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { beaudleService, BeaudleGameState } from '../services/beaudleService';
import { BeaudleCourse } from './beaudle/courses';
import { CourseSelector } from './beaudle/CourseSelector';
import { GuessRow, GuessRowHeader } from './beaudle/GuessRow';
import { BeaudleStatsPanel } from './beaudle/BeaudleStatsPanel';
import { BeaudleSuccessModal } from './beaudle/BeaudleSuccessModal';
import { styles } from './beaudle/BeaudleScreen.styles';
import { withMinimumDelay } from '../utils/refresh';

export const BeaudleScreen: React.FC = () => {
  const [game, setGame] = useState<BeaudleGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const fetchToday = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      const data = await beaudleService.getToday();
      setGame(data);
    } catch (err) {
      console.error('Error fetching Beaudle:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchToday();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    const subRefresh = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchToday(true));
      setLoading(false);
    });
    return () => subRefresh.remove();
  }, []);

  const handlePullRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchToday(true));
  };

  const handleGuess = async (course: BeaudleCourse) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await beaudleService.submitGuess(course.code);
      setGame(data);
      if (data.status === 'won') {
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'No se pudo registrar tu intento.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudo cargar el Beaudle de hoy.</Text>
      </View>
    );
  }

  const isInProgress = game.status === 'in_progress';
  const guessedCodes = game.guesses.map((g) => g.code);
  const ownBucket = !isInProgress
    ? (game.status === 'won' ? String(game.guesses.length) : 'failed')
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <View style={styles.intro}>
        <Text style={styles.title}>Beaudle</Text>
        <Text style={styles.subtitle}>
          Adivina el ramo secreto del Plan Común de hoy. Cada intento compara departamento, semestre y créditos.
        </Text>
        {isInProgress && (
          <Text style={styles.guessesRemaining}>
            Te quedan {game.guessesRemaining} de {game.maxGuesses} intentos.
          </Text>
        )}
      </View>

      {game.status === 'lost' && (
        <View style={[styles.endBanner, styles.endBannerLost]}>
          <Text style={styles.endBannerTitle}>Se acabaron los intentos.</Text>
          {game.revealedCourse && (
            <Text style={styles.endBannerText}>
              El ramo secreto era {game.revealedCourse.name} ({game.revealedCourse.code}).
            </Text>
          )}
        </View>
      )}

      {game.guesses.length > 0 && <GuessRowHeader />}
      {game.guesses.map((g, idx) => (
        <GuessRow key={`${g.code}-${idx}`} guess={g} />
      ))}

      {isInProgress && (
        <View style={styles.pickerSection}>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <CourseSelector disabledCodes={guessedCodes} disabled={submitting} onConfirm={handleGuess} />
        </View>
      )}

      {!isInProgress && <BeaudleStatsPanel stats={game.stats} ownBucket={ownBucket} />}

      <BeaudleSuccessModal
        visible={showSuccessModal}
        guessCount={game.guesses.length}
        courseName={game.revealedCourse?.name}
        courseCode={game.revealedCourse?.code}
        onClose={() => setShowSuccessModal(false)}
      />
    </ScrollView>
  );
};
