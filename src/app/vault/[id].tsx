import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { eq, and } from 'drizzle-orm';
import { Button, Card, H1, Body, Label } from '@/components/ui';
import { TicketCard, TicketEditorModal } from '@/components/tickets';
import { EncryptedGallery } from '@/components/media';
import { useSessionStore } from '@/stores/useSessionStore';
import { getDatabase } from '@/db/client';
import { resources, Resource } from '@/db/schema';
import {
  createTicket,
  getDecryptedTickets,
  DecryptedTicket,
  TicketPayload,
} from '@/services/tickets/ticketService';
import { deleteResource } from '@/services/resources/resourceManager';

type ContentTab = 'tickets' | 'photos';

export default function VaultDetailScreen() {
  const { id: vaultId } = useLocalSearchParams<{ id: string }>();
  const activeVaultKey = useSessionStore((state) => state.activeVaultKey);

  const [activeTab, setActiveTab] = useState<ContentTab>('tickets');
  const [ticketList, setTicketList] = useState<DecryptedTicket[]>([]);
  const [photoList, setPhotoList] = useState<Resource[]>([]);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  const loadContent = useCallback(async () => {
    if (!vaultId || !activeVaultKey) return;

    try {
      // Load decrypted tickets
      const decrypted = await getDecryptedTickets(vaultId, activeVaultKey);
      setTicketList(decrypted);

      // Load photos
      const db = await getDatabase();
      const photoRows = await db
        .select()
        .from(resources)
        .where(and(eq(resources.vaultId, vaultId), eq(resources.type, 'photo')));
      setPhotoList(photoRows);
    } catch (err) {
      console.error('Failed to load vault content:', err);
    }
  }, [vaultId, activeVaultKey]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleCreateTicket = async (payload: TicketPayload) => {
    if (!vaultId || !activeVaultKey) return;
    await createTicket(vaultId, payload, activeVaultKey);
    await loadContent();
  };

  const handleDeleteResource = async (resourceId: string) => {
    await deleteResource(resourceId);
    await loadContent();
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
      {/* Segmented Monochrome Tabs */}
      <View className="flex-row border border-zinc-800 mb-5">
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

      <TicketEditorModal
        visible={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        onSubmit={handleCreateTicket}
      />
    </View>
  );
}
