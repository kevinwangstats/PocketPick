import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { eq } from 'drizzle-orm';
import { Button, Card, H1, Body, Label } from '@/components/ui';
import { TicketCard, TicketEditorModal } from '@/components/tickets';
import { EncryptedGallery } from '@/components/media';
import { VaultMasterPromptModal } from '@/components/vault';
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

  const [vaultName, setVaultName] = useState('VAULT');
  const [activeTab, setActiveTab] = useState<ContentTab>('tickets');
  const [ticketList, setTicketList] = useState<DecryptedTicket[]>([]);
  const [photoList, setPhotoList] = useState<Resource[]>([]);
  const [allVaultResources, setAllVaultResources] = useState<Resource[]>([]);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isMasterPromptModalOpen, setIsMasterPromptModalOpen] = useState(false);

  // In-Vault Picker State
  const [isWeighted, setIsWeighted] = useState(false);
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
    isWeighted,
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
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Label className="mb-2 text-zinc-600">[ ACCESS DENIED ]</Label>
        <H1 className="mb-4 text-center">VAULT IS LOCKED</H1>
        <Body className="text-zinc-500 text-center mb-6">
          Authenticate with your master passphrase to decrypt and inspect items.
        </Body>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black px-4 pt-4">
      {/* Vault Header with Master Prompt Settings */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-1 pr-2">
          <Label className="text-zinc-500">ACTIVE VAULT</Label>
          <Text
            className="text-white font-mono font-bold text-base tracking-wider"
            numberOfLines={1}
          >
            {vaultName.toUpperCase()}
          </Text>
        </View>
        <Pressable
          onPress={() => setIsMasterPromptModalOpen(true)}
          className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 active:border-white"
        >
          <Text className="text-xs font-mono text-zinc-300 tracking-wider">[ MASTER PROMPT ]</Text>
        </Pressable>
      </View>

      {/* Segmented Monochrome Tabs */}
      <View className="flex-row border border-zinc-800 mb-4">
        <Pressable
          onPress={() => setActiveTab('tickets')}
          className={`flex-1 py-2.5 items-center ${
            activeTab === 'tickets' ? 'bg-white' : 'bg-black'
          }`}
        >
          <Text
            className={`font-mono text-xs uppercase tracking-wider ${
              activeTab === 'tickets' ? 'text-black font-bold' : 'text-zinc-400'
            }`}
          >
            TICKETS ({ticketList.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('photos')}
          className={`flex-1 py-2.5 items-center ${
            activeTab === 'photos' ? 'bg-white' : 'bg-black'
          }`}
        >
          <Text
            className={`font-mono text-xs uppercase tracking-wider ${
              activeTab === 'photos' ? 'text-black font-bold' : 'text-zinc-400'
            }`}
          >
            PHOTOS ({photoList.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('pick')}
          className={`flex-1 py-2.5 items-center ${activeTab === 'pick' ? 'bg-white' : 'bg-black'}`}
        >
          <Text
            className={`font-mono text-xs uppercase tracking-wider ${
              activeTab === 'pick' ? 'text-black font-bold' : 'text-zinc-400'
            }`}
          >
            PICK
          </Text>
        </Pressable>
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
                MODE: {isWeighted ? 'WEIGHTED' : 'UNIFORM'} • POOL: {typeFilter.toUpperCase()} (
                {activePool.length})
              </Label>
            </View>
            <Button
              variant="secondary"
              className="h-8 px-3"
              onPress={() => setFilterModalVisible(true)}
              disabled={pickerState === 'shuffling' || pickerState === 'decelerating'}
            >
              FILTER & WEIGHTS
            </Button>
          </View>

          {/* Monospace Shuffle Display */}
          <ShuffleDisplay
            state={pickerState}
            displayItem={currentDisplayItem}
            totalPoolSize={activePool.length}
          />

          {pickerError && (
            <Card className="border border-zinc-700 bg-zinc-900 p-3 mt-4">
              <Body className="text-xs text-white font-mono">{pickerError}</Body>
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
      <View className="py-2.5 border-t border-zinc-900 items-center">
        <Pressable
          onPress={handleDeleteVault}
          className="px-4 py-1.5 border border-red-900/60 active:bg-red-950"
        >
          <Text className="text-[11px] font-mono text-red-500 uppercase tracking-widest">
            [ DESTROY VAULT ]
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
        isWeighted={isWeighted}
        onToggleWeighted={setIsWeighted}
        typeFilter={typeFilter}
        onSelectTypeFilter={setTypeFilter}
      />
    </View>
  );
}
