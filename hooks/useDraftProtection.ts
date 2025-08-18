import { DraftData } from '@/lib/drafts';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';

type UseDraftProtectionProps = {
  hasUnsavedChanges: boolean;
  draftData: DraftData;
  onSaveDraft: (data: DraftData) => Promise<void>;
  onDiscardDraft: () => void;
};

export function useDraftProtection({
  hasUnsavedChanges,
  draftData,
  onSaveDraft,
  onDiscardDraft,
}: UseDraftProtectionProps) {
  const navigationInterceptedRef = useRef(false);

  const showDraftDialog = useCallback(() => {
    if (!hasUnsavedChanges) return false;

    Alert.alert(
      "Save Draft?",
      "You have unsaved changes. Would you like to save them as a draft?",
      [
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            // For discard, we need to actually delete the draft from database
            onDiscardDraft();
            navigationInterceptedRef.current = false;
            // Complete pending navigation after discarding with a slight delay
            setTimeout(() => {
              (global as any).completePendingNavigation?.();
            }, 50);
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            navigationInterceptedRef.current = false;
            // Clear pending navigation on cancel - don't navigate
            const globalObj = global as any;
            if (globalObj.completePendingNavigation) {
              // Clear the pending navigation without executing it
              globalObj.completePendingNavigation = null;
            }
          },
        },
        {
          text: "Save Draft",
          onPress: async () => {
            try {
              await onSaveDraft(draftData);
              // Clear the form after saving draft
              onDiscardDraft();
              navigationInterceptedRef.current = false;
              // Complete pending navigation after saving draft with a slight delay
              setTimeout(() => {
                (global as any).completePendingNavigation?.();
              }, 50);
            } catch (error) {
              console.error('Failed to save draft:', error);
              Alert.alert("Error", "Failed to save draft. Please try again.");
              navigationInterceptedRef.current = false;
            }
          },
        },
      ],
      { cancelable: false }
    );
    return true;
  }, [hasUnsavedChanges, draftData, onSaveDraft, onDiscardDraft]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasUnsavedChanges && !navigationInterceptedRef.current) {
        navigationInterceptedRef.current = true;
        showDraftDialog();
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    });

    return () => backHandler.remove();
  }, [hasUnsavedChanges, showDraftDialog]);

  // Function to call before programmatic navigation
  const checkBeforeNavigation = useCallback(() => {
    if (hasUnsavedChanges && !navigationInterceptedRef.current) {
      navigationInterceptedRef.current = true;
      return showDraftDialog();
    }
    return false;
  }, [hasUnsavedChanges, showDraftDialog]);

  return {
    checkBeforeNavigation,
  };
}
