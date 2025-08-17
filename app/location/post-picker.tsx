// /app/location/post-picker.tsx
import { getOneShot } from "@/lib/location";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import MapView, { Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PostLocationPicker() {
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<Region>({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  useEffect(() => {
    // Check if there are initial coordinates from LocationPicker
    const initialCoords = (global as any).initialLocationCoords;
    if (initialCoords) {
      console.log("Using initial coordinates:", initialCoords);
      setRegion({
        latitude: initialCoords.lat,
        longitude: initialCoords.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      // Clear the initial coordinates
      delete (global as any).initialLocationCoords;
    } else {
      // Try to get current location on mount
      (async () => {
        try {
          const cur = await getOneShot();
          setRegion({
            latitude: cur.latitude,
            longitude: cur.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });
        } catch (error) {
          console.log("Failed to get current location, using fallback");
        }
      })();
    }
  }, []);

  function onRegionChangeComplete(r: Region) {
    setRegion(r);
  }

  async function useMyLocation() {
    try {
      const cur = await getOneShot();
      const newRegion = {
        latitude: cur.latitude,
        longitude: cur.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(newRegion);
    } catch (error) {
      Alert.alert("Location Error", "Could not get your current location. Please try again.");
    }
  }

  async function onConfirm() {
    // Pass the coordinates back via URL params
    const coords = {
      lat: region.latitude,
      lng: region.longitude
    };
    console.log("Selected coordinates:", coords);
    
    // Perform reverse geocoding to get venue name or address
    let locationLabel = "";
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: region.latitude,
        longitude: region.longitude,
      });
      
      if (reverseGeocode.length > 0) {
        const location = reverseGeocode[0];
        console.log("Reverse geocode result:", location);
        
        // Priority 1: Venue name (name field)
        if (location.name && location.name !== location.street) {
          locationLabel = location.name;
        }
        // Priority 2: Address (street + city)
        else if (location.street || location.city) {
          const parts = [];
          if (location.street) parts.push(location.street);
          if (location.city) parts.push(location.city);
          locationLabel = parts.join(", ");
        }
        // Priority 3: Fallback to coordinates
        else {
          locationLabel = `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`;
        }
      } else {
        // No reverse geocoding results, use coordinates
        locationLabel = `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`;
      }
    } catch (error) {
      console.log("Reverse geocoding failed:", error);
      // Fallback to coordinates
      locationLabel = `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`;
    }
    
    console.log("Final location label:", locationLabel);
    
    // Store coordinates and label in a way the LocationPicker can access them
    // Using a simple global approach for now
    (global as any).selectedLocationCoords = coords;
    (global as any).selectedLocationLabel = locationLabel;
    
    router.back();
  }

  function onCancel() {
    router.back();
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        zoomEnabled={true}
        scrollEnabled={true}
        rotateEnabled={false}
        showsCompass={false}
        showsPointsOfInterest={true}
        toolbarEnabled={false}
      />
      
      {/* Stationary pin in center - like Uber */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          marginLeft: -12,
          marginTop: -24, // Adjust for pin height
          width: 24,
          height: 24,
        }}
      >
        <Text style={{ fontSize: 24, textAlign: "center" }}>📍</Text>
      </View>
      

      {/* Bottom controls */}
      <View style={{ 
        position: "absolute", 
        bottom: 0, 
        left: 0, 
        right: 0,
        backgroundColor: "#fff",
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        padding: 12,
        paddingBottom: Math.max(12, insets.bottom + 8), // Add safe area padding
      }}>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
          <Pressable
            onPress={useMyLocation}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              flex: 1,
              borderWidth: 1,
              borderColor: "#cbd5e1",
              paddingVertical: 12,
              alignItems: "center",
              borderRadius: 10,
              backgroundColor: "#fff",
            })}
          >
            <Text style={{ fontWeight: "700" }}>Use my location</Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              paddingVertical: 12,
              paddingHorizontal: 14,
              alignItems: "center",
              borderRadius: 10,
            })}
          >
            <Text style={{ fontWeight: "700" }}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              alignItems: "center",
              borderRadius: 10,
              backgroundColor: "#2563eb",
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Confirm</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
