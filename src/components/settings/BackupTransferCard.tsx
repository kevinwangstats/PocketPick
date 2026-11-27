import React, { useState } from 'react';
import { View, Modal, Text, Alert, Switch, Pressable } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Card, H2, Body, Button, Input, ErrorText } from '../ui';
import { useSessionStore } from '../../stores/useSessionStore';
import { exportEncryptedBackup, importEncryptedBackup } from '../../services/backup/backupService';
import { useTheme } from '../../theme';

export const BackupTransferCard: React.FC = () => {
  const { theme } = useTheme();
  const appSessionKey = useSessionStore((state) => state.appSessionKey);

  const [mode, setMode] = useState<'export' | 'import' | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [includeChats, setIncludeChats] = useState(true);
  const [selectedImportUri, setSelectedImportUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const closeModal = () => {
    setMode(null);
    setPassphrase('');
    setConfirmPassphrase('');
    setSelectedImportUri(null);
    setError(null);
  };

  const handleExport = async () => {
    if (!appSessionKey) return;
    setError(null);
    if (passphrase.length < 6) {
      setError('Backup passphrase must be at least 6 characters');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Backup passphrases do not match');
      return;
    }

    setIsBusy(true);
    try {
      const res = await exportEncryptedBackup({
        sessionKey: appSessionKey,
        backupPassphrase: passphrase,
        includeChats,
        shareArchive: async (archiveUri) => {
          await Sharing.shareAsync(archiveUri, {
            dialogTitle: 'Export Encrypted OOTD Backup',
            UTI: 'public.data',
          });
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      closeModal();
      Alert.alert(
        'Export Complete',
        `Exported ${res.personsCount} person(s), ${res.photosCount} photo(s), ${res.looksCount} look(s), and ${res.chatsCount} chat message(s).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePickImportFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: '*/*',
    });
    if (!picked.canceled && picked.assets[0]?.uri) {
      setSelectedImportUri(picked.assets[0].uri);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!appSessionKey || !selectedImportUri) {
      setError('Select a .ootdbackup file first');
      return;
    }
    if (!passphrase) {
      setError('Enter the backup passphrase');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const res = await importEncryptedBackup({
        archiveUri: selectedImportUri,
        backupPassphrase: passphrase,
        sessionKey: appSessionKey,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      closeModal();
      Alert.alert(
        'Import Complete',
        `Restored ${res.personsImported} person(s), ${res.photosImported} photo(s) (${res.photosDeduplicated} duplicate skipped), ${res.looksImported} look(s), and ${res.chatsImported} chat message(s).`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Import failed. Verify the backup passphrase and archive integrity.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card className="p-5 mb-6">
      <H2 className="mb-1">
        {theme.isUppercase ? 'IPHONE TRANSFER & BACKUP' : 'iPhone Transfer & Backup'}
      </H2>
      <Body className="text-xs mb-4">
        Export all AI Personalities, Plain-Text Memories, Wardrobe & Past OOTD photos, and Chats
        into a passphrase-encrypted `.ootdbackup` archive for moving to a new iPhone.
      </Body>

      <View className="flex-row gap-2">
        <Button variant="primary" className="flex-1" onPress={() => setMode('export')}>
          Export Backup
        </Button>
        <Button variant="secondary" className="flex-1" onPress={() => setMode('import')}>
          Import Backup
        </Button>
      </View>

      <Modal visible={Boolean(mode)} transparent animationType="slide" onRequestClose={closeModal}>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Card className="p-5">
            <View className="flex-row justify-between items-center mb-3">
              <H2>{mode === 'export' ? 'Export Encrypted Backup' : 'Import Encrypted Backup'}</H2>
              <Pressable onPress={closeModal} hitSlop={8}>
                <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Close</Text>
              </Pressable>
            </View>

            {mode === 'export' ? (
              <>
                <Body className="text-xs mb-3">
                  Your OpenRouter API key is never exported. Choose a dedicated backup passphrase to
                  encrypt the archive.
                </Body>
                <View className="flex-row justify-between items-center mb-4">
                  <Text style={{ color: theme.colors.textPrimary, fontSize: 13 }}>
                    Include Chat History
                  </Text>
                  <Switch
                    value={includeChats}
                    onValueChange={setIncludeChats}
                    trackColor={{ false: theme.colors.cardBorder, true: theme.colors.accent }}
                  />
                </View>
                <Input
                  label="Backup Passphrase"
                  placeholder="Min 6 characters..."
                  secureTextEntry
                  isMono
                  value={passphrase}
                  onChangeText={setPassphrase}
                />
                <Input
                  label="Confirm Backup Passphrase"
                  placeholder="Re-enter passphrase..."
                  secureTextEntry
                  isMono
                  value={confirmPassphrase}
                  onChangeText={setConfirmPassphrase}
                />
                {error && <ErrorText className="mb-3">{error}</ErrorText>}
                <Button variant="primary" loading={isBusy} onPress={handleExport}>
                  Generate & Share .ootdbackup
                </Button>
              </>
            ) : (
              <>
                <Body className="text-xs mb-3">
                  Select a `.ootdbackup` file and enter its backup passphrase to merge into this
                  iPhone.
                </Body>
                <Button variant="secondary" className="mb-3" onPress={handlePickImportFile}>
                  {selectedImportUri
                    ? 'File Selected ✓ (Tap to Change)'
                    : 'Choose .ootdbackup File'}
                </Button>
                <Input
                  label="Backup Passphrase"
                  placeholder="Enter backup passphrase..."
                  secureTextEntry
                  isMono
                  value={passphrase}
                  onChangeText={setPassphrase}
                />
                {error && <ErrorText className="mb-3">{error}</ErrorText>}
                <Button variant="primary" loading={isBusy} onPress={handleImport}>
                  Verify & Import Backup
                </Button>
              </>
            )}
          </Card>
        </View>
      </Modal>
    </Card>
  );
};
