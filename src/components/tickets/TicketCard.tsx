import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Body } from '../ui';
import { DecryptedTicket } from '../../services/tickets/ticketService';
import { useTheme } from '../../theme';

export interface TicketCardProps {
  ticket: DecryptedTicket;
  onPress?: () => void;
  onDelete?: () => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onPress, onDelete }) => {
  const { theme } = useTheme();

  return (
    <Card className="mb-3">
      <Pressable onPress={onPress} className="active:opacity-80">
        <View className="flex-row justify-between items-center mb-1.5">
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontWeight: '700',
              fontSize: 15,
              fontFamily: theme.isMono ? 'Courier' : undefined,
              letterSpacing: theme.isUppercase ? 0.5 : 0,
              flex: 1,
              marginRight: 8,
            }}
            numberOfLines={1}
          >
            {theme.isUppercase ? ticket.title.toUpperCase() : ticket.title}
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 6 : 0,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: theme.colors.badgeText,
                fontSize: 11,
                fontWeight: '600',
                fontFamily: theme.isMono ? 'Courier' : undefined,
              }}
            >
              W: {ticket.weight}
            </Text>
          </View>
        </View>

        {ticket.content ? (
          <Body
            style={{ color: theme.colors.textSecondary }}
            className="text-sm mb-3"
            numberOfLines={3}
          >
            {ticket.content}
          </Body>
        ) : (
          <Body style={{ color: theme.colors.textMuted }} className="text-sm mb-3">
            No content details.
          </Body>
        )}
      </Pressable>

      {onDelete && (
        <View
          style={{ borderTopWidth: 1, borderTopColor: theme.colors.divider }}
          className="pt-2 flex-row justify-end"
        >
          <Pressable
            onPress={onDelete}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: theme.colors.destructiveButtonBorder,
              backgroundColor: theme.colors.destructiveButtonBg,
              borderRadius: theme.borderRadius ? 6 : 0,
            }}
            className="active:opacity-75"
          >
            <Text
              style={{
                color: theme.colors.destructiveButtonText,
                fontSize: 11,
                fontFamily: theme.isMono ? 'Courier' : undefined,
                fontWeight: '600',
                letterSpacing: theme.isUppercase ? 0.8 : 0,
              }}
            >
              {theme.isUppercase ? 'DELETE' : 'Delete'}
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
};
