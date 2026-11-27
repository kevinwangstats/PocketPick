import React, { useState, useCallback } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { desc, eq } from 'drizzle-orm';
import { Button, Card, H1, Body, Label } from '@/components/ui';
import { PersonCard, PersonFormModal, QuickStartCard } from '@/components/persons';
import { PersonalityMemoryModal } from '@/components/settings';
import { useTheme } from '@/theme';
import { useSessionStore } from '@/stores/useSessionStore';
import { Person, chatMessages, photos } from '@/db/schema';
import { getDatabase } from '@/db/client';
import { decryptString } from '@/crypto/cipher';
import { listPersons, deletePerson, createPerson } from '@/services/persons/personService';
import { DESIGNER_PERSONA_PRESETS } from '@/services/persons/personaPresets';
import { isOpenRouterKeyConfigured } from '@/services/llm/llmKeyStore';

interface PersonPreviewMeta {
  previewText: string | null;
  previewTime: Date | null;
}

export default function ChatsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const appSessionKey = useSessionStore((state) => state.appSessionKey);

  const [personList, setPersonList] = useState<Person[]>([]);
  const [previews, setPreviews] = useState<Record<string, PersonPreviewMeta>>({});
  const [hasApiKey, setHasApiKey] = useState(true);
  const [hasWardrobePhotos, setHasWardrobePhotos] = useState(true);
  const [dismissedChecklist, setDismissedChecklist] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [memoryPerson, setMemoryPerson] = useState<Person | null>(null);

  const loadDirectory = useCallback(async () => {
    if (!appSessionKey) return;
    try {
      const [rows, keyConfigured, db] = await Promise.all([
        listPersons(),
        isOpenRouterKeyConfigured(),
        getDatabase(),
      ]);

      setHasApiKey(keyConfigured);

      const wardrobeCheck = await db
        .select({ id: photos.id })
        .from(photos)
        .where(eq(photos.photoKind, 'wardrobe'))
        .limit(1);
      setHasWardrobePhotos(wardrobeCheck.length > 0);

      // Load latest decrypted chat preview per person
      const nextPreviews: Record<string, PersonPreviewMeta> = {};
      for (const p of rows) {
        const latest = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.personId, p.id))
          .orderBy(desc(chatMessages.createdAt))
          .limit(1);

        if (latest[0]) {
          try {
            const text = decryptString(
              {
                ciphertext: latest[0].encryptedContent,
                iv: latest[0].contentIv,
                tag: latest[0].contentTag,
              },
              appSessionKey,
              p.id,
            );
            nextPreviews[p.id] = { previewText: text, previewTime: latest[0].createdAt };
          } catch {
            nextPreviews[p.id] = {
              previewText: '[Encrypted message]',
              previewTime: latest[0].createdAt,
            };
          }
        }
      }

      // Sort persons by latest chat activity then updatedAt
      const sorted = [...rows].sort((a, b) => {
        const ta = (nextPreviews[a.id]?.previewTime ?? a.updatedAt).getTime();
        const tb = (nextPreviews[b.id]?.previewTime ?? b.updatedAt).getTime();
        return tb - ta;
      });

      setPreviews(nextPreviews);
      setPersonList(sorted);
    } catch (err) {
      console.error('Failed to load chats directory:', err);
    }
  }, [appSessionKey]);

  useFocusEffect(
    useCallback(() => {
      loadDirectory();
    }, [loadDirectory]),
  );

  const handleQuickAddStarter = async () => {
    const starter = DESIGNER_PERSONA_PRESETS[0];
    try {
      const created = await createPerson({
        name: starter.name,
        bio: starter.bio,
        tonePreset: starter.tonePreset,
        personalityPrompt: starter.personalityPrompt,
      });
      await loadDirectory();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push({ pathname: '/chat/[id]', params: { id: created.id } });
    } catch {
      setIsFormOpen(true);
    }
  };

  const handleDeletePerson = (person: Person) => {
    Alert.alert('Delete Person', `Remove "${person.name}" and her conversation?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Confirm Permanent Deletion',
            `All encrypted chat logs, plain-text memories, and portrait photos for "${person.name}" will be permanently shredded.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Permanently Shred',
                style: 'destructive',
                onPress: async () => {
                  await deletePerson(person.id);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                    () => {},
                  );
                  await loadDirectory();
                },
              },
            ],
          );
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      className="flex-1 px-4 py-5"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Label className="mb-0.5">DESIGNER PERSONALITIES</Label>
          <H1>{theme.isUppercase ? 'CHATS' : 'Chats'}</H1>
        </View>
        <Button
          variant="secondary"
          className="h-9 px-3"
          onPress={() => {
            setEditingPerson(null);
            setIsFormOpen(true);
          }}
        >
          + New Person
        </Button>
      </View>

      {!dismissedChecklist && (
        <QuickStartCard
          hasApiKey={hasApiKey}
          hasPersons={personList.length > 0}
          hasWardrobePhotos={hasWardrobePhotos}
          onGoToSettings={() => router.push('/(tabs)/settings')}
          onQuickAddStarter={handleQuickAddStarter}
          onGoToWardrobe={() => router.push('/(tabs)/wardrobe')}
          onDismiss={() => setDismissedChecklist(true)}
        />
      )}

      {personList.length === 0 ? (
        <Card className="p-5 items-center">
          <Label className="mb-2">NO STYLISTS YET</Label>
          <Body className="text-center mb-4 text-xs">
            Create an AI Person with her own personality, portrait photo, and voice to chat and
            curate your daily OOTD.
          </Body>
          <View className="w-full gap-2">
            <Button variant="primary" onPress={handleQuickAddStarter}>
              Start with Celeste (Parisian Atelier)
            </Button>
            <Button
              variant="secondary"
              onPress={() => {
                setEditingPerson(null);
                setIsFormOpen(true);
              }}
            >
              Create Custom Person
            </Button>
          </View>
        </Card>
      ) : (
        personList.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            sessionKey={appSessionKey}
            lastMessagePreview={previews[person.id]?.previewText}
            lastMessageTime={previews[person.id]?.previewTime}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: person.id } })}
            onEditPress={() => {
              setEditingPerson(person);
              setIsFormOpen(true);
            }}
            onDeletePress={() => handleDeletePerson(person)}
          />
        ))
      )}

      <PersonFormModal
        visible={isFormOpen}
        person={editingPerson}
        sessionKey={appSessionKey}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => {
          loadDirectory();
        }}
        onOpenMemory={(p) => setMemoryPerson(p)}
      />

      <PersonalityMemoryModal
        visible={Boolean(memoryPerson)}
        person={memoryPerson}
        onClose={() => setMemoryPerson(null)}
        onSaved={loadDirectory}
      />
    </ScrollView>
  );
}
