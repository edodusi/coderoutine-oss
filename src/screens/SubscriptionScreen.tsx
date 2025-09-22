import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../hooks/useSubscription';
import { useModal } from '../context/ModalContext';
import { subscriptionService } from '../services/subscriptionService';
import type { PurchasesPackage } from 'react-native-purchases';
import { getUniqueDeviceIdSync } from '../utils/deviceId';
import { useToast } from '../components/Toast';
import * as Clipboard from 'expo-clipboard';

const SubscriptionScreen: React.FC = () => {
  const { theme } = useTheme();
  const {
    showSuccessModal,
    showErrorModal,
    showLoadingModal,
    hideLoadingModal,
  } = useModal();
  const { showSuccessToast, showErrorToast } = useToast();
  const {
    isSubscribed,
    setIsSubscribed,
    offerings,
    customerInfo,
    purchaseLoading,
    restoreLoading,
    offeringsLoading,
    purchaseSubscription,
    restorePurchases,
    refreshCustomerInfo,
    lastError,
    clearError,
  } = useSubscription();

  const deviceId = getUniqueDeviceIdSync();

  const handleCopyDeviceId = async () => {
    try {
      if (deviceId.includes('-temp-')) {
        showSuccessToast('Device ID is still loading, please try again in a moment');
        return;
      }
      await Clipboard.setStringAsync(deviceId);
      showSuccessToast('📋 Device ID copied to clipboard');
    } catch (error) {
      showErrorToast('Failed to copy Device ID to clipboard');
    }
  };

  const handlePurchasePackage = async (packageToPurchase: PurchasesPackage) => {
    clearError();
    showLoadingModal('Processing Purchase...', 'Please wait while we process your subscription.');

    try {
      await purchaseSubscription(packageToPurchase);

      hideLoadingModal();

      // Check if purchase was successful by checking subscription status
      if (isSubscribed && !lastError) {
        showSuccessModal(
          '🎉 Subscription Activated!',
          'Thank you for subscribing! You now have access to all premium features including AI summaries, translations, and ad-free reading.'
        );
      } else if (lastError) {
        // Only show error if there's actually an error (not cancellation)
        showErrorModal(
          '❌ Purchase Failed',
          lastError,
          undefined,
          () => handlePurchasePackage(packageToPurchase)
        );
      }
      // If no error and not subscribed, it was likely cancelled - do nothing
    } catch (error) {
      hideLoadingModal();
      console.error('Error in purchase handler:', error);

      // Check if error should be shown (cancellation errors are hidden)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (subscriptionService.shouldShowError(error)) {
        showErrorModal(
          '❌ Purchase Failed',
          errorMessage,
          undefined,
          () => handlePurchasePackage(packageToPurchase)
        );
      }
    }
  };

  const handleRestorePurchases = async () => {
    try {
      clearError();
      showLoadingModal('Restoring Purchases...', 'Checking for existing subscriptions in your account.');

      await restorePurchases();

      hideLoadingModal();

      if (isSubscribed && !lastError) {
        showSuccessModal(
          '✅ Purchases Restored',
          'Your subscription has been restored successfully!'
        );
      } else if (!lastError) {
        showErrorModal(
          'ℹ️ No Active Subscriptions',
          'No active subscriptions were found to restore.',
          'If you believe this is an error, please contact support.'
        );
      } else {
        showErrorModal(
          '❌ Restore Failed',
          lastError,
          'Please check your internet connection and try again.'
        );
      }
    } catch (error) {
      hideLoadingModal();
      console.error('Error in restore handler:', error);
      showErrorModal(
        '❌ Restore Failed',
        error instanceof Error ? error.message : 'Failed to restore purchases',
        'Please check your internet connection and try again.',
        () => handleRestorePurchases()
      );
    }
  };

  const handleRefreshStatus = async () => {
    try {
      clearError();
      await refreshCustomerInfo();
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getPackageDisplayName = (pkg: PurchasesPackage): string => {
    // Try to get a readable name from the package
    if (pkg.product.title) return pkg.product.title;

    // Fallback to identifier-based naming
    if (pkg.identifier.includes('monthly')) return 'Monthly Subscription';
    if (pkg.identifier.includes('annual') || pkg.identifier.includes('yearly')) return 'Annual Subscription';
    if (pkg.identifier.includes('weekly')) return 'Weekly Subscription';

    return 'Premium Subscription';
  };

  const getPackageDescription = (pkg: PurchasesPackage): string => {
    if (pkg.product.description) return pkg.product.description;

    // Generate description based on package type
    if (pkg.identifier.includes('monthly')) return 'Billed monthly, cancel anytime';
    if (pkg.identifier.includes('annual') || pkg.identifier.includes('yearly')) return 'Best value - save with annual billing';
    if (pkg.identifier.includes('weekly')) return 'Perfect for short-term access';

    return 'Access to all premium features';
  };

  const getStatusIcon = () => {
    if (isSubscribed) {
      return { name: 'checkmark-circle' as const, color: theme.colors.success };
    }
    return { name: 'diamond' as const, color: theme.colors.textSecondary };
  };

  const statusIcon = getStatusIcon();

  // Get active entitlement info for display
  const activeEntitlement = customerInfo?.entitlements.active ?
    Object.values(customerInfo.entitlements.active)[0] : null;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 16,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
      paddingTop: 20,
    },
    headerIcon: {
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    statusSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    statusIcon: {
      marginRight: 12,
    },
    statusTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: isSubscribed ? theme.colors.success + '20' : theme.colors.textSecondary + '20',
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: isSubscribed ? theme.colors.success : theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
    statusDetails: {
      gap: 12,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusLabel: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    statusValue: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
      flex: 1,
      textAlign: 'right',
    },
    packagesSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    packageItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    packageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    packageNameContainer: {
      flex: 1,
      marginRight: 12,
    },
    packageName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    packagePriceContainer: {
      alignItems: 'flex-end',
      minWidth: 80,
    },
    packagePrice: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.primary,
      textAlign: 'right',
    },
    packageDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    packageButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    packageButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    actionsSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    button: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 12,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonIcon: {
      marginRight: 10,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    featuresSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    featureIcon: {
      marginRight: 12,
    },
    featureText: {
      fontSize: 16,
      color: theme.colors.text,
      flex: 1,
    },
    errorSection: {
      backgroundColor: theme.colors.error + '10',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.error + '30',
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.error,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons
              name="diamond"
              size={64}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.headerTitle}>CodeRoutine Premium</Text>
          <Text style={styles.headerSubtitle}>
            Unlock AI summaries, translations, and AI-generated podcasts!
          </Text>
        </View>

        {/* Error Display */}
        {lastError && (
          <View style={styles.errorSection}>
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        )}

        {/* Current Status */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Ionicons
              name={statusIcon.name}
              size={24}
              color={statusIcon.color}
              style={styles.statusIcon}
            />
            <Text style={styles.statusTitle}>Subscription Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {isSubscribed ? 'Active' : 'Free'}
              </Text>
            </View>
          </View>

          <View style={styles.statusDetails}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusValue}>
                {isSubscribed ? 'Premium Active' : 'Free Plan'}
              </Text>
            </View>

            {activeEntitlement && (
              <>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Product</Text>
                  <Text style={styles.statusValue}>
                    CodeRoutine Monthly
                  </Text>
                </View>

                {activeEntitlement.originalPurchaseDate && (
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Started</Text>
                    <Text style={styles.statusValue}>
                      {formatDate(activeEntitlement.originalPurchaseDate)}
                    </Text>
                  </View>
                )}

                {activeEntitlement.expirationDate && (
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Next Renewal</Text>
                    <Text style={styles.statusValue}>
                      {formatDate(activeEntitlement.expirationDate)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Subscription Packages */}
        {!isSubscribed && (
          <View style={styles.packagesSection}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>

            {offeringsLoading ? (
              <Text style={styles.loadingText}>Loading subscription options...</Text>
            ) : offerings?.availablePackages && offerings.availablePackages.length > 0 ? (
              offerings.availablePackages.map((pkg: PurchasesPackage) => (
                <View key={pkg.identifier} style={styles.packageItem}>
                  <View style={styles.packageHeader}>
                    <View style={styles.packageNameContainer}>
                      <Text style={styles.packageName}>
                        {getPackageDescription(pkg)}
                      </Text>
                    </View>
                    <View style={styles.packagePriceContainer}>
                      <Text style={styles.packagePrice}>
                        {pkg.product.priceString || 'Price unavailable'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.packageButton}
                    onPress={() => handlePurchasePackage(pkg)}
                    disabled={purchaseLoading}
                  >
                    <Text style={styles.packageButtonText}>
                      {purchaseLoading ? 'Processing...' : 'Subscribe'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.loadingText}>
                No subscription options available at this time.
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {/* Restore Purchases */}
          <TouchableOpacity
            style={[
              styles.button,
              restoreLoading && styles.buttonDisabled
            ]}
            onPress={handleRestorePurchases}
            disabled={restoreLoading}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={theme.colors.text}
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>
              {restoreLoading ? 'Restoring...' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>

          {/* Refresh Status */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleRefreshStatus}
          >
            <Ionicons
              name="sync"
              size={20}
              color={theme.colors.text}
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>Check Status</Text>
          </TouchableOpacity>

          {/* DEV actions */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setIsSubscribed(true);
              }}
            >
              <Ionicons
                name="settings"
                size={20}
                color={theme.colors.text}
                style={styles.buttonIcon}
              />
              <Text style={styles.buttonText}>Set Subscription as Active</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Premium Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Premium Features</Text>

          <View style={styles.featureItem}>
            <Ionicons
              name="sparkles"
              size={20}
              color={isSubscribed ? theme.colors.success : theme.colors.textSecondary}
              style={styles.featureIcon}
            />
            <Text style={[styles.featureText, {
              color: isSubscribed ? theme.colors.text : theme.colors.textSecondary
            }]}>
              AI-powered article summaries
            </Text>
            {isSubscribed && (
              <Ionicons name="checkmark" size={16} color={theme.colors.success} />
            )}
          </View>

          <View style={styles.featureItem}>
            <Ionicons
              name="language"
              size={20}
              color={isSubscribed ? theme.colors.success : theme.colors.textSecondary}
              style={styles.featureIcon}
            />
            <Text style={[styles.featureText, {
              color: isSubscribed ? theme.colors.text : theme.colors.textSecondary
            }]}>
              AI translations of summaries
            </Text>
            {isSubscribed && (
              <Ionicons name="checkmark" size={16} color={theme.colors.success} />
            )}
          </View>

          <View style={styles.featureItem}>
            <Ionicons
              name="headset"
              size={20}
              color={isSubscribed ? theme.colors.success : theme.colors.textSecondary}
              style={styles.featureIcon}
            />
            <Text style={[styles.featureText, {
              color: isSubscribed ? theme.colors.text : theme.colors.textSecondary
            }]}>
              AI-generated podcasts
            </Text>
            {isSubscribed && (
              <Ionicons name="checkmark" size={16} color={theme.colors.success} />
            )}
          </View>

          <View style={styles.featureItem}>
            <Ionicons
              name="eye-off"
              size={20}
              color={isSubscribed ? theme.colors.success : theme.colors.textSecondary}
              style={styles.featureIcon}
            />
            <Text style={[styles.featureText, {
              color: isSubscribed ? theme.colors.text : theme.colors.textSecondary
            }]}>
              Always ad-free
            </Text>
            {isSubscribed && (
              <Ionicons name="checkmark" size={16} color={theme.colors.success} />
            )}
          </View>

          <View style={styles.featureItem}>
            <Ionicons
              name="heart"
              size={20}
              color={isSubscribed ? theme.colors.success : theme.colors.textSecondary}
              style={styles.featureIcon}
            />
            <Text style={[styles.featureText, {
              color: isSubscribed ? theme.colors.text : theme.colors.textSecondary
            }]}>
              Cloud sync (coming soon)
            </Text>
            {isSubscribed && (
              <Ionicons name="checkmark" size={16} color={theme.colors.success} />
            )}
          </View>
        </View>

        {/* Support Info */}
        {isSubscribed && (
          <View style={styles.featuresSection}>
            <View style={styles.featureItem}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={theme.colors.success}
                style={styles.featureIcon}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureText, { color: theme.colors.success, fontWeight: '600' }]}>
                  Thank you for your support! 🎉
                </Text>
                <Text style={[styles.featureText, {
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginTop: 4
                }]}>
                  You're helping us build better coding education tools.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Help Section */}
        <View style={[styles.featuresSection, { marginBottom: 60 }]}>
          <Text style={styles.sectionTitle}>Need Help?</Text>

          <Text style={[styles.featureText, {
            color: theme.colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
            marginBottom: 16
          }]}>
            Having issues with your subscription? Contact us at{' '}
            <Text style={{ color: theme.colors.primary, fontWeight: '500' }}>
              coderoutine@edoardodusi.com
            </Text>
          </Text>

          <TouchableOpacity
            style={[styles.button, { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary,
              marginBottom: 0
            }]}
            onPress={handleCopyDeviceId}
          >
            <Ionicons
              name="copy-outline"
              size={20}
              color={theme.colors.primary}
              style={styles.buttonIcon}
            />
            <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
              Copy Device ID for Support
            </Text>
          </TouchableOpacity>

          <Text style={[styles.featureText, {
            color: theme.colors.textSecondary,
            fontSize: 12,
            lineHeight: 16,
            textAlign: 'center',
            marginTop: 8,
            fontStyle: 'italic'
          }]}>
            Include your Device ID when contacting support for faster assistance
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SubscriptionScreen;
