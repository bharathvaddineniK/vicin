import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "GUEST_MODE";
const GUEST_SESSION_KEY = "GUEST_SESSION_ID";

// in-memory cache for immediate checks
let guestCached = false;
let guestSessionId: string | null = null;
let initPromise: Promise<void> | null = null;

// Initialize guest state from storage
async function initializeGuestState(): Promise<void> {
  try {
    const [guestMode, sessionId] = await Promise.all([
      AsyncStorage.getItem(KEY),
      AsyncStorage.getItem(GUEST_SESSION_KEY)
    ]);
    
    guestCached = guestMode === "1";
    guestSessionId = sessionId;
  } catch (error) {
    console.warn("Failed to initialize guest state:", error);
    guestCached = false;
    guestSessionId = null;
  }
}

// Ensure initialization happens only once
function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeGuestState();
  }
  return initPromise;
}

export async function startGuest(): Promise<void> {
  await ensureInitialized();
  
  guestCached = true;
  guestSessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    await Promise.all([
      AsyncStorage.setItem(KEY, "1"),
      AsyncStorage.setItem(GUEST_SESSION_KEY, guestSessionId)
    ]);
  } catch (error) {
    console.error("Failed to start guest mode:", error);
    // Revert in-memory state on failure
    guestCached = false;
    guestSessionId = null;
    throw error;
  }
}

export async function endGuest(): Promise<void> {
  await ensureInitialized();
  
  guestCached = false;
  guestSessionId = null;
  
  try {
    await Promise.all([
      AsyncStorage.removeItem(KEY),
      AsyncStorage.removeItem(GUEST_SESSION_KEY)
    ]);
  } catch (error) {
    console.error("Failed to end guest mode:", error);
    // Don't throw here as we want to ensure cleanup happens
  }
}

export function isGuestCached(): boolean {
  return guestCached;
}

export async function isGuestNow(): Promise<boolean> {
  await ensureInitialized();
  return guestCached;
}

export async function getGuestSessionId(): Promise<string | null> {
  await ensureInitialized();
  return guestSessionId;
}

// Validate guest state consistency
export async function validateGuestState(): Promise<boolean> {
  try {
    await ensureInitialized();
    
    const [storageMode, storageSessionId] = await Promise.all([
      AsyncStorage.getItem(KEY),
      AsyncStorage.getItem(GUEST_SESSION_KEY)
    ]);
    
    const storageGuest = storageMode === "1";
    const memoryGuest = guestCached;
    
    // Check for inconsistency
    if (storageGuest !== memoryGuest) {
      console.warn("Guest state inconsistency detected, syncing...");
      guestCached = storageGuest;
      guestSessionId = storageSessionId;
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Failed to validate guest state:", error);
    return false;
  }
}

// Clean up any orphaned guest data
export async function cleanupGuestData(): Promise<void> {
  try {
    // Clear any temporary files or cached data related to guest sessions
    // This could be expanded to clean up other guest-related data
    await Promise.all([
      AsyncStorage.removeItem(KEY),
      AsyncStorage.removeItem(GUEST_SESSION_KEY)
    ]);
    
    guestCached = false;
    guestSessionId = null;
  } catch (error) {
    console.error("Failed to cleanup guest data:", error);
  }
}
