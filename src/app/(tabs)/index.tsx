import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, H1, Body, Label } from '@/components/ui';
import { VaultCard, CreateVaultModal, UnlockVaultModal } from '@/components/vault';
import { useVaultAuth } from '@/hooks/useVaultAuth';
import { getDatabase } from '@/db/client';
import { vaults as vaultsTable, Vault } from '@/db/schema';

export default function VaultsScreen() {
  const router = useRouter();
  const { activeVaultId, isUnlocked, createVault, unlockVault, lockVault } = useVaultAuth();

  const [vaultList, setVaultList] = useState<Vault[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetUnlockVault, setTargetUnlockVault] = useState<Vault | null>(null);

  const loadVaults = useCallback(async () => {
    try {
      const db = await getDatabase();
      const records = await db.select().from(vaultsTable);
      setVaultList(records);
    } catch (err) {
      console.error('Error loading vaults:', err);
    }
  }, []);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  const handleCreateVault = async (name: string, description: string, passphrase: string) => {
    const newId = await createVault(name, description, passphrase);
    await loadVaults();
    router.push({ pathname: '/vault/[id]', params: { id: newId } });
  };

  const handleSelectVault = (vault: Vault) => {
    if (activeVaultId === vault.id && isUnlocked) {
      router.push({ pathname: '/vault/[id]', params: { id: vault.id } });
    } else {
      setTargetUnlockVault(vault);
    }
  };

  const handleUnlockSuccess = async (passphrase: string): Promise<boolean> => {
    if (!targetUnlockVault) return false;
    const success = await unlockVault(targetUnlockVault.id, passphrase);
    if (success) {
      const unlockedId = targetUnlockVault.id;
      setTargetUnlockVault(null);
      router.push({ pathname: '/vault/[id]', params: { id: unlockedId } });
      return true;
    }
    return false;
  };

  return (
    <ScrollView className="flex-1 bg-black px-5 py-6">
      <Label className="mb-2">ENVELOPE ENCRYPTION ACTIVE</Label>
      <H1 className="mb-6">SECURE VAULTS</H1>

      <View className="flex-row justify-between items-center mb-4">
        <Label>{vaultList.length} PROVISIONED VAULTS</Label>
        <Button variant="secondary" onPress={() => setIsCreateModalOpen(true)} className="h-9 px-3">
          + NEW VAULT
        </Button>
      </View>

      {vaultList.length === 0 ? (
        <Card className="mb-4">
          <Label className="mb-2">NO ACTIVE VAULTS</Label>
          <Body className="text-zinc-500 mb-4">
            Initialize an isolated vault to store encrypted notes and photos.
          </Body>
          <Button variant="primary" onPress={() => setIsCreateModalOpen(true)}>
            CREATE FIRST VAULT
          </Button>
        </Card>
      ) : (
        vaultList.map((vault) => (
          <VaultCard
            key={vault.id}
            id={vault.id}
            name={vault.name}
            description={vault.description}
            isUnlocked={activeVaultId === vault.id && isUnlocked}
            onPress={() => handleSelectVault(vault)}
            onLockPress={lockVault}
          />
        ))
      )}

      <CreateVaultModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateVault}
      />

      <UnlockVaultModal
        visible={Boolean(targetUnlockVault)}
        vaultName={targetUnlockVault?.name ?? ''}
        onClose={() => setTargetUnlockVault(null)}
        onUnlock={handleUnlockSuccess}
      />
    </ScrollView>
  );
}
