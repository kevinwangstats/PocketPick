import { useVaultTimeoutStore } from '@/stores/useVaultTimeoutStore';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { eq } from 'drizzle-orm';
import { Button, Card, H1, Body, Label } from '@/components/ui';
import { useTheme } from '@/theme';
import { TicketCard, TicketEditorModal } from '@/components/tickets';
import { EncryptedGallery } from '@/components/media';
import { VaultMasterPromptModal, UnlockVaultModal } from '@/components/vault';
import { useVaultAuth } from '@/hooks/useVaultAuth';
import {
  ShuffleDisplay,
  WinnerCard,
  WeightFilterModal,
  ResourceTypeFilter,
} from '@/components/picker';
import { useSessionStore } from '@/stores/useSessionStore';
import { usePicker } from '@/hooks/usePicker';
import { getDatabase } from '@/db/client';
import { resources, Resource } from '@/db/schema';
import { getVault } from '@/services/vault/vaultService';
import {
  createTicket,
  getDecryptedTickets,
  DecryptedTicket,
  TicketPayload,
} from '@/services/tickets/ticketService';
import { deleteResource, deleteVault } from '@/services/resources/resourceManager';

type ContentTab = 'tickets' | 'photos' | 'pick';

export default function VaultDetailScreen() {
  const router = useRouter();
  const { id: vaultId } = useLocalSearchParams<{ id: string }>();
  const activeVaultKey = useSessionStore((state) => state.activeVaultKey);
  const { theme } = useTheme();

  const [vaultName, setVaultName] = useState('VAULT');
  const [activeTab, setActiveTab] = useState<ContentTab>('tickets');
  const [ticketList, setTicketList] = useState<DecryptedTicket[]>([]);
  const [photoList, setPhotoList] = useState<Resource[]>([]);
  const [allVaultResources, setAllVaultResources] = useState<Resource[]>([]);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isMasterPromptModalOpen, setIsMasterPromptModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const { unlockVault } = useVaultAuth();

  // In-Vault Picker State
  const [typeFilter, setTypeFilter] = useState<ResourceTypeFilter>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const loadContent = useCallback(async () => {
    if (!vaultId || !activeVaultKey) return;

    try {
      const vaultRecord = await getVault(vaultId);
      if (vaultRecord) {
        setVaultName(vaultRecord.name);
      }

      // Load decrypted tickets
      const decrypted = await getDecryptedTickets(vaultId, activeVaultKey);
      setTicketList(decrypted);

      // Load raw resources for this vault
      const db = await getDatabase();
      const rows = await db.select().from(resources).where(eq(resources.vaultId, vaultId));
      setAllVaultResources(rows);
      setPhotoList(rows.filter((r) => r.type === 'photo'));
    } catch (err) {
      console.error('Failed to load vault content:', err);
    }
  }, [vaultId, activeVaultKey]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // When timeout is 0m, leaving the vault automatically locks it to always require the password
  useEffect(() => {
    return () => {
      const timeout = useVaultTimeoutStore.getState().timeoutMinutes;
      if (timeout === 0) {
        useSessionStore.getState().lockVault();
      }
    };
  }, []);

  // Scoped pool for in-vault CSPRNG picker
  const activePool = useMemo(() => {
    return allVaultResources.filter((item) => {
      if (typeFilter === 'all') return true;
      return item.type === typeFilter;
    });
  }, [allVaultResources, typeFilter]);

  const {
    state: pickerState,
    winner,
    currentDisplayItem,
    error: pickerError,
    startShuffle,
    reset: resetPicker,
  } = usePicker({
    vaultId: vaultId ?? '',
    vaultKey: activeVaultKey,
    items: activePool,
    onPickLogged: () => {
      // Pick recorded
    },
  });

  const handleCreateTicket = async (payload: TicketPayload) => {
    if (!vaultId || !activeVaultKey) return;
    try {
      await createTicket(vaultId, payload, activeVaultKey);
      await loadContent();
    } catch (err) {
      console.error('Failed to create ticket:', err);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    try {
      await deleteResource(resourceId);
      await loadContent();
    } catch (err) {
      console.error('Failed to delete resource:', err);
    }
  };

  const handleDeleteVault = () => {
    Alert.alert('Delete Vault', 'Are you sure you want to delete this vault?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Vault',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Confirm Permanent Deletion',
            'FINAL WARNING: All tickets, photos, and cryptographic keys will be permanently shredded from storage.\n\nThis cannot be undone. Are you absolutely certain?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Permanently Shred',
                style: 'destructive',
                onPress: async () => {
                  try {
                    if (vaultId) {
                      useSessionStore.getState().lockVault();
                      await deleteVault(vaultId);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                        () => {},
                      );
                      router.replace('/(tabs)');
                    }
                  } catch (err) {
                    console.error('Failed to delete vault:', err);
                    Alert.alert('Error', 'Failed to delete vault.');
                  }
                },
              },
            ],
          );
        },
      },
    ]);
  };

  if (!activeVaultKey) {
    return (
      <View
        style={{ backgroundColor: theme.colors.background }}
        className="flex-1 items-center justify-center px-6"
      >
        <Label className="mb-2 text-zinc-600">[ ACCESS DENIED ]</Label>
        <H1 className="mb-4 text-center">
          {theme.isUppercase ? 'VAULT IS LOCKED' : 'Vault is Locked'}
        </H1>
        <Body className="text-zinc-500 text-center mb-6">
          Authenticate with your master passphrase to decrypt and inspect items.
        </Body>
        <View className="flex-row gap-3 w-full max-w-xs">
          <Button variant="secondary" className="flex-1" onPress={() => router.replace('/(tabs)')}>
            {theme.isUppercase ? 'ALL VAULTS' : 'All Vaults'}
          </Button>
          <Button variant="primary" className="flex-1" onPress={() => setIsUnlockModalOpen(true)}>
            {theme.isUppercase ? 'UNLOCK' : 'Unlock'}
          </Button>
        </View>

        <UnlockVaultModal
          visible={isUnlockModalOpen}
          vaultName={vaultName}
          onClose={() => setIsUnlockModalOpen(false)}
          onUnlock={async (passphrase) => {
            if (!vaultId) return false;
            const success = await unlockVault(vaultId, passphrase);
            if (success) {
              setIsUnlockModalOpen(false);
              await loadContent();
            }
            return success;
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: theme.colors.background }} className="flex-1 px-4 pt-4">
      {/* Vault Header with Master Prompt Settings */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-1 pr-2">
          <Label>ACTIVE VAULT</Label>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontFamily: theme.isMono ? 'Courier' : undefined,
              fontWeight: '700',
              fontSize: 16,
              letterSpacing: theme.isUppercase ? 0.8 : 0,
            }}
            numberOfLines={1}
          >
            {theme.isUppercase ? vaultName.toUpperCase() : vaultName}
          </Text>
        </View>
        <Pressable
          onPress={() => setIsMasterPromptModalOpen(true)}
          style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.cardBorder,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 8 : 0,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
          className="active:opacity-80"
        >
          <Text
            style={{
              color: theme.colors.accent,
              fontFamily: theme.isMono ? 'Courier' : undefined,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: theme.isUppercase ? 0.8 : 0,
            }}
          >
            {theme.isUppercase ? '[ MASTER PROMPT ]' : 'Master Prompt'}
          </Text>
        </Pressable>
      </View>

      {/* Segmented Adaptive Theme Tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.badgeBg,
          borderRadius: theme.borderRadius ? 10 : 0,
          padding: 3,
          marginBottom: 16,
          borderWidth: theme.isDark ? 1 : 0,
          borderColor: theme.colors.cardBorder,
        }}
      >
        {(
          [
            {
              id: 'tickets',
              label: theme.isUppercase
                ? `TICKETS (${ticketList.length})`
                : `Tickets (${ticketList.length})`,
            },
            {
              id: 'photos',
              label: theme.isUppercase
                ? `PHOTOS (${photoList.length})`
                : `Photos (${photoList.length})`,
            },
            { id: 'pick', label: theme.isUppercase ? 'PICK' : 'Pick' },
          ] as const
        ).map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.borderRadius ? 8 : 0,
                backgroundColor: isSelected ? theme.colors.card : 'transparent',
                shadowColor: isSelected && !theme.isDark ? '#000000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isSelected && !theme.isDark ? 0.08 : 0,
                shadowRadius: 2,
                elevation: isSelected && !theme.isDark ? 1 : 0,
              }}
            >
              <Text
                style={{
                  color: isSelected ? theme.colors.accent : theme.colors.textMuted,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: 12,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                  letterSpacing: theme.isUppercase ? 0.8 : 0,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <ScrollView className="flex-1">
          <View className="flex-row justify-between items-center mb-4">
            <Label>{ticketList.length} DECRYPTED NOTES</Label>
            <Button
              variant="secondary"
              onPress={() => setIsTicketModalOpen(true)}
              className="h-9 px-3"
            >
              + NEW TICKET
            </Button>
          </View>

          {ticketList.length === 0 ? (
            <Card className="py-8 items-center justify-center">
              <Label className="mb-2">EMPTY VAULT</Label>
              <Body className="text-zinc-500 text-center mb-4">
                Add confidential notes, tasks, or weighted selection tickets.
              </Body>
              <Button variant="primary" onPress={() => setIsTicketModalOpen(true)}>
                CREATE FIRST TICKET
              </Button>
            </Card>
          ) : (
            ticketList.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onDelete={() => handleDeleteResource(ticket.id)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <EncryptedGallery
          vaultId={vaultId!}
          vaultKey={activeVaultKey}
          photos={photoList}
          onRefresh={loadContent}
          onDeletePhoto={handleDeleteResource}
        />
      )}

      {/* In-Vault Pick Tab */}
      {activeTab === 'pick' && (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Controls bar */}
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Label className="text-zinc-400 text-xs">
                SELECTION: UNIFORM • POOL: {typeFilter.toUpperCase()} ({activePool.length})
              </Label>
            </View>
            <Button
              variant="secondary"
              className="h-8 px-3"
              onPress={() => setFilterModalVisible(true)}
              disabled={pickerState === 'shuffling' || pickerState === 'decelerating'}
            >
              FILTER POOL
            </Button>
          </View>

          {/* Monospace Shuffle Display */}
          <ShuffleDisplay
            state={pickerState}
            displayItem={currentDisplayItem}
            totalPoolSize={activePool.length}
          />

          {pickerError && (
            <Card
              style={{
                borderColor: theme.colors.destructiveButtonBorder,
                backgroundColor: theme.colors.destructiveButtonBg,
              }}
              className="p-3 mt-4"
            >
              <Body
                style={{ color: theme.colors.destructiveButtonText }}
                className="text-xs font-mono"
              >
                {pickerError}
              </Body>
            </Card>
          )}

          {/* Decrypted Winner Card */}
          {winner && (
            <WinnerCard
              winner={winner}
              onRePick={() => startShuffle('re_pick')}
              onConfirm={resetPicker}
            />
          )}

          {/* Pick Trigger Button */}
          {pickerState !== 'revealed' && (
            <View className="mt-6">
              <Button
                variant="primary"
                loading={pickerState === 'shuffling' || pickerState === 'decelerating'}
                disabled={activePool.length === 0}
                onPress={() => startShuffle('pick')}
              >
                {pickerState === 'idle' ? 'EXECUTE CSPRNG PICK' : 'SAMPLING POOL...'}
              </Button>
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom Danger Action */}
      <View
        style={{ borderTopWidth: 1, borderTopColor: theme.colors.divider }}
        className="py-2.5 items-center"
      >
        <Pressable
          onPress={handleDeleteVault}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: theme.colors.destructiveButtonBorder,
            backgroundColor: theme.colors.destructiveButtonBg,
            borderRadius: theme.borderRadius ? 8 : 0,
          }}
          className="active:opacity-75"
        >
          <Text
            style={{
              color: theme.colors.destructiveButtonText,
              fontSize: 11,
              fontFamily: theme.isMono ? 'Courier' : undefined,
              fontWeight: '600',
              letterSpacing: theme.isUppercase ? 1.2 : 0,
            }}
          >
            {theme.isUppercase ? '[ DESTROY VAULT ]' : 'Destroy Vault'}
          </Text>
        </Pressable>
      </View>

      <TicketEditorModal
        visible={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        onSubmit={handleCreateTicket}
      />

      <VaultMasterPromptModal
        visible={isMasterPromptModalOpen}
        vaultId={vaultId!}
        vaultName={vaultName}
        onClose={() => setIsMasterPromptModalOpen(false)}
      />

      <WeightFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        typeFilter={typeFilter}
        onSelectTypeFilter={setTypeFilter}
      />
    </View>
  );
}
