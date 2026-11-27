import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, H2, Label, Body } from '../ui';
import { Person } from '../../db/schema';
import { listPersons } from '../../services/persons/personService';
import { PersonalityMemoryModal } from './PersonalityMemoryModal';
import { useTheme } from '../../theme';

export const PersonalityMemoriesCard: React.FC = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const [personList, setPersonList] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const loadPersons = useCallback(async () => {
    try {
      const rows = await listPersons();
      setPersonList(rows);
    } catch {
      // Ignore if DB not initialized
    }
  }, []);

  useEffect(() => {
    loadPersons();
  }, [loadPersons]);

  useFocusEffect(
    useCallback(() => {
      loadPersons();
    }, [loadPersons]),
  );

  const countRecordedTraits = (memoryText: string): number => {
    return memoryText.split('\n').filter((line) => line.trim().startsWith('- ')).length;
  };

  return (
    <Card className="p-5 mb-6">
      <H2 className="mb-1">
        {theme.isUppercase ? 'PERSONALITY MEMORIES' : 'Personality Memories'}
      </H2>
      <Body className="text-xs mb-4">
        Plain-text style, color & fabric memories recorded distinctly for each AI stylist.
      </Body>

      {personList.length === 0 ? (
        <View
          style={{
            backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
            borderColor: theme.colors.cardBorder,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 8 : 0,
            padding: 12,
          }}
        >
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 12,
              fontFamily: theme.isMono ? 'Courier' : undefined,
            }}
          >
            Create your first AI Person in Chats to view and edit her personal style memory.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {personList.map((person) => {
            const traitCount = countRecordedTraits(person.memoryText || '');
            return (
              <Pressable
                key={person.id}
                onPress={() => setSelectedPerson(person)}
                style={{
                  backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
                  borderColor: theme.colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 10 : 0,
                  padding: 12,
                }}
                className="flex-row items-center justify-between active:opacity-80"
              >
                <View className="flex-1 pr-2">
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontWeight: '700',
                      fontSize: 14,
                      fontFamily: theme.isMono ? 'Courier' : undefined,
                    }}
                  >
                    {person.name}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 11,
                      marginTop: 2,
                      fontFamily: theme.isMono ? 'Courier' : undefined,
                    }}
                    numberOfLines={1}
                  >
                    {traitCount} recorded preference{traitCount === 1 ? '' : 's'} • Tap to inspect
                  </Text>
                </View>
                <Label style={{ color: theme.colors.accent }}>VIEW / EDIT</Label>
              </Pressable>
            );
          })}
        </View>
      )}

      <PersonalityMemoryModal
        visible={Boolean(selectedPerson)}
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
        onSaved={loadPersons}
        onJumpToChat={(personId) =>
          router.push({ pathname: '/chat/[id]', params: { id: personId } })
        }
      />
    </Card>
  );
};
