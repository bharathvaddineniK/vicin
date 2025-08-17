// lib/memoryMonitor.ts
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

interface MemoryInfo {
  used: number;
  total: number;
  available: number;
  percentage: number;
}

interface MemoryWarning {
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
}

// Memory thresholds (in MB)
const MEMORY_THRESHOLDS = {
  low: 100,      // 100MB available
  medium: 75,    // 75MB available
  high: 50,      // 50MB available
  critical: 25,  // 25MB available
};

// Global memory monitoring state
let isMonitoring = false;
let monitoringInterval: ReturnType<typeof setInterval> | null = null;
let memoryWarningCallbacks: ((warning: MemoryWarning) => void)[] = [];
let lastCleanupTime = 0;
const CLEANUP_COOLDOWN = 30000; // 30 seconds between cleanups

/**
 * Get current memory information (mock implementation for React Native)
 * In a real app, you might use a native module to get actual memory stats
 */
async function getMemoryInfo(): Promise<MemoryInfo | null> {
  try {
    // This is a simplified mock - in production you'd use a native module
    // or platform-specific APIs to get real memory information
    if (Platform.OS === 'android') {
      // On Android, we can estimate based on available storage and typical memory patterns
      const info = await FileSystem.getFreeDiskStorageAsync();
      const estimatedTotal = 2048; // Assume 2GB RAM as baseline
      const estimatedUsed = Math.max(0, estimatedTotal - (info / (1024 * 1024))); // Very rough estimate
      
      return {
        used: estimatedUsed,
        total: estimatedTotal,
        available: estimatedTotal - estimatedUsed,
        percentage: (estimatedUsed / estimatedTotal) * 100
      };
    }
    
    // For iOS or other platforms, return null (no monitoring)
    return null;
  } catch (error) {
    console.warn("Failed to get memory info:", error);
    return null;
  }
}

/**
 * Check memory levels and trigger warnings if needed
 */
async function checkMemoryLevels(): Promise<void> {
  try {
    const memInfo = await getMemoryInfo();
    if (!memInfo) return;
    
    const availableMB = memInfo.available;
    let warningLevel: MemoryWarning['level'] | null = null;
    let message = '';
    
    if (availableMB <= MEMORY_THRESHOLDS.critical) {
      warningLevel = 'critical';
      message = `Critical memory warning: Only ${availableMB.toFixed(0)}MB available`;
    } else if (availableMB <= MEMORY_THRESHOLDS.high) {
      warningLevel = 'high';
      message = `High memory usage: ${availableMB.toFixed(0)}MB available`;
    } else if (availableMB <= MEMORY_THRESHOLDS.medium) {
      warningLevel = 'medium';
      message = `Medium memory usage: ${availableMB.toFixed(0)}MB available`;
    } else if (availableMB <= MEMORY_THRESHOLDS.low) {
      warningLevel = 'low';
      message = `Low memory warning: ${availableMB.toFixed(0)}MB available`;
    }
    
    if (warningLevel) {
      const warning: MemoryWarning = {
        level: warningLevel,
        message,
        timestamp: Date.now()
      };
      
      // Notify all registered callbacks
      memoryWarningCallbacks.forEach(callback => {
        try {
          callback(warning);
        } catch (error) {
          console.error("Error in memory warning callback:", error);
        }
      });
      
      // Trigger automatic cleanup for high/critical warnings
      if ((warningLevel === 'high' || warningLevel === 'critical') && 
          Date.now() - lastCleanupTime > CLEANUP_COOLDOWN) {
        await performEmergencyCleanup();
        lastCleanupTime = Date.now();
      }
    }
  } catch (error) {
    console.error("Error checking memory levels:", error);
  }
}

/**
 * Perform emergency memory cleanup
 */
async function performEmergencyCleanup(): Promise<void> {
  try {
    console.log("Performing emergency memory cleanup...");
    
    // Clean up temporary files
    await cleanupTempFiles();
    
    // Clear image caches (if using a caching library)
    // This would depend on your image caching implementation
    
    // Force garbage collection (if available)
    if (global.gc) {
      global.gc();
    }
    
    console.log("Emergency cleanup completed");
  } catch (error) {
    console.error("Error during emergency cleanup:", error);
  }
}

/**
 * Clean up temporary files to free storage and potentially memory
 */
async function cleanupTempFiles(): Promise<void> {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;
    
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const file of files) {
      try {
        const filePath = `${cacheDir}${file}`;
        const info = await FileSystem.getInfoAsync(filePath);
        
        if (info.exists && info.modificationTime) {
          const age = now - info.modificationTime;
          if (age > maxAge) {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
          }
        }
      } catch (error) {
        // Ignore individual file errors
        console.warn(`Failed to cleanup file ${file}:`, error);
      }
    }
  } catch (error) {
    console.error("Error cleaning up temp files:", error);
  }
}

/**
 * Start memory monitoring
 */
export function startMemoryMonitoring(intervalMs: number = 10000): void {
  if (isMonitoring) return;
  
  isMonitoring = true;
  monitoringInterval = setInterval(checkMemoryLevels, intervalMs);
  
  console.log("Memory monitoring started");
}

/**
 * Stop memory monitoring
 */
export function stopMemoryMonitoring(): void {
  if (!isMonitoring) return;
  
  isMonitoring = false;
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  console.log("Memory monitoring stopped");
}

/**
 * Register a callback for memory warnings
 */
export function onMemoryWarning(callback: (warning: MemoryWarning) => void): () => void {
  memoryWarningCallbacks.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = memoryWarningCallbacks.indexOf(callback);
    if (index > -1) {
      memoryWarningCallbacks.splice(index, 1);
    }
  };
}

/**
 * Manually trigger memory cleanup
 */
export async function triggerMemoryCleanup(): Promise<void> {
  await performEmergencyCleanup();
}

/**
 * Get current memory status
 */
export async function getMemoryStatus(): Promise<MemoryInfo | null> {
  return await getMemoryInfo();
}

/**
 * Check if memory monitoring is supported on current platform
 */
export function isMemoryMonitoringSupported(): boolean {
  return Platform.OS === 'android'; // Extend as needed
}
