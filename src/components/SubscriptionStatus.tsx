import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useModal } from '../context/ModalContext';

export interface SubscriptionStatusProps {
  showActions?: boolean;
  compact?: boolean;
  banner?: boolean;
  onNavigateToSubscription?: () => void;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  showActions = false,
  compact = false,
  banner = false,
  onNavigateToSubscription,
}) => {
  const { theme } = useTheme();
  const {
    subscriptionStatus,
    isSubscribed,
    subscriptionConnected,
    subscriptionPrice,
    purchaseLoading,
    restoreLoading,
    purchaseSubscription,
    restorePurchases,
  } = useApp();

  const {
    showStoreUnavailableModal,
  } = useModal();

  const handleSubscriptionPurchase = async () => {
    if (!subscriptionConnected) {
      showStoreUnavailableModal();
      return;
    }

    try {
      await purchaseSubscription();
    } catch (error) {
      console.error('Error in subscription purchase handler:', error);
    }
  };

  const handleRestorePurchases = async () => {
    if (!subscriptionConnected) {
      showStoreUnavailableModal();
      return;
    }

    try {
      await restorePurchases();
    } catch (error) {
      console.error('Error in restore purchases handler:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusIcon = () => {
    if (!subscriptionConnected) {
      return { name: 'cloud-offline' as const, color: theme.colors.textSecondary };
    }
    if (isSubscribed) {
      return { name: 'checkmark-circle' as const, color: theme.colors.success };
    }
    return { name: 'diamond' as const, color: theme.colors.primary };
  };

  const statusIcon = getStatusIcon();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: banner 
        ? `${theme.colors.primary}15` 
        : theme.colors.card,
      borderRadius: compact ? 8 : 12,
      padding: compact ? 12 : 16,
      elevation: banner ? 1 : 2,
      shadowOpacity: banner ? 0.05 : 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      borderWidth: banner ? 1 : 0,
      borderColor: banner ? `${theme.colors.primary}30` : 'transparent',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: compact ? 8 : 12,
    },
    icon: {
      marginRight: 12,
    },
    title: {
      fontSize: compact ? 16 : 18,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isSubscribed ? theme.colors.success + '20' : theme.colors.textSecondary + '20',
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: isSubscribed ? theme.colors.success : theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
    details: {
      marginBottom: showActions ? 16 : 0,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: compact ? 4 : 6,
    },
    detailLabel: {
      fontSize: compact ? 13 : 14,
      color: theme.colors.textSecondary,
    },
    detailValue: {
      fontSize: compact ? 13 : 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    connectionWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.warning + '20',
      borderRadius: 6,
      padding: 8,
      marginTop: 8,
    },
    connectionWarningText: {
      fontSize: 12,
      color: theme.colors.warning,
      marginLeft: 6,
    },
    actionsContainer: {
      gap: 8,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonIcon: {
      marginRight: 6,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonTextSecondary: {
      color: theme.colors.text,
    },
    navigateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    navigateText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons
          name={statusIcon.name}
          size={compact ? 20 : 24}
          color={statusIcon.color}
          style={styles.icon}
        />
        <Text style={styles.title}>
          {banner 
            ? (!isSubscribed ? '✨ Unlock Premium Features' : '🎉 Premium Active')
            : compact 
              ? 'Premium' 
              : 'Subscription Status'
          }
        </Text>
        {!banner && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {isSubscribed ? (__DEV__ ? 'DEV' : 'Active') : 'Free'}
            </Text>
          </View>
        )}
      </View>

      {banner && !isSubscribed && (
        <View style={styles.details}>
          <Text style={[styles.detailValue, { 
            textAlign: 'center', 
            color: theme.colors.primary,
            marginBottom: 8 
          }]}>
            Get AI summaries, translations, and ad-free reading for just {subscriptionPrice}/month
          </Text>
        </View>
      )}

      {!compact && !banner && (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Plan</Text>
            <Text style={styles.detailValue}>
              {isSubscribed ? (__DEV__ ? 'Development Mode (Premium Active)' : 'CodeRoutine Premium') : 'Free Tier'}
            </Text>
          </View>

          {subscriptionStatus.expiryTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Renews</Text>
              <Text style={styles.detailValue}>
                {formatDate(subscriptionStatus.expiryTime)}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.detailValue}>
              {isSubscribed ? `${subscriptionPrice}/month` : subscriptionPrice}
            </Text>
          </View>
        </View>
      )}

      {!subscriptionConnected && (
        <View style={styles.connectionWarning}>
          <Ionicons
            name="warning"
            size={14}
            color={theme.colors.warning}
          />
          <Text style={styles.connectionWarningText}>
            Store connection unavailable
          </Text>
        </View>
      )}

      {showActions && (
        <View style={styles.actionsContainer}>
          {!isSubscribed && (
            <TouchableOpacity
              style={[
                styles.button,
                (purchaseLoading || !subscriptionConnected) && styles.buttonDisabled
              ]}
              onPress={handleSubscriptionPurchase}
              disabled={purchaseLoading || !subscriptionConnected}
            >
              <Ionicons
                name="diamond"
                size={16}
                color="#FFFFFF"
                style={styles.buttonIcon}
              />
              <Text style={styles.buttonText}>
                {purchaseLoading ? 'Processing...' : `Subscribe ${subscriptionPrice}`}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonSecondary,
              (restoreLoading || !subscriptionConnected) && styles.buttonDisabled
            ]}
            onPress={handleRestorePurchases}
            disabled={restoreLoading || !subscriptionConnected}
          >
            <Ionicons
              name="refresh"
              size={16}
              color={theme.colors.text}
              style={styles.buttonIcon}
            />
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              {restoreLoading ? 'Restoring...' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>

          {onNavigateToSubscription && (
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={onNavigateToSubscription}
            >
              <Text style={styles.navigateText}>View Details</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default SubscriptionStatus;