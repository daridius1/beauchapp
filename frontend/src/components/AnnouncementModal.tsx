import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Modal, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { announcementsService, AnnouncementRecord } from '../services/announcementsService';
import { MarkdownRenderer } from './MarkdownRenderer';

export const AnnouncementModal: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [announcement, setAnnouncement] = useState<AnnouncementRecord | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!user) {
      setAnnouncement(null);
      return;
    }
    let isMounted = true;
    announcementsService.getLatestAnnouncement().then((latest) => {
      if (!isMounted || !latest) return;
      if (latest.id !== user.last_seen_announcement) {
        setAnnouncement(latest);
      }
    });
    return () => { isMounted = false; };
  }, [user?.id]);

  const handleConfirm = async () => {
    if (!user || !announcement || confirming) return;
    setConfirming(true);
    try {
      await announcementsService.markSeen(user.id, announcement.id);
      await refreshUser();
      setAnnouncement(null);
    } catch (err) {
      console.error('Error marking announcement as seen:', err);
    } finally {
      setConfirming(false);
    }
  };

  if (!announcement) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>{announcement.title}</Text>
            <MarkdownRenderer content={announcement.body} height={400} />
          </ScrollView>

          <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.8} onPress={handleConfirm} disabled={confirming}>
            {confirming ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>Entendido</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: '#0c0c0c',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#262626',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
  },
  confirmBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  confirmBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
