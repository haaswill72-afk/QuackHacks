import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
// Fix: Import CameraView instead of the legacy generic Camera object
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  // Fallback check while permissions load
  if (!permission) {
    return <View style={styles.container} />;
  }

  // If permission isn't granted yet, show a clean request button
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.centerButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>GRANT CAMERA PERMISSION</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const captureAndAnalyze = async () => {
    if (!cameraRef.current || loading) return;
    
    try {
      setLoading(true);
      print("Capturing frame...");
      
      // 1. Take photo using the updated CameraView API syntax
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.5,
        base64: false
      });
      
      // 2. Format photo data to send to our Python server
      const formData = new FormData();
      formData.append('image', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      // 3. Hit your Flask Backend Server 
      // Remember to change this to your computer's actual local Wi-Fi IP address!
      const response = await fetch('http://10.108.105.217:5001/analyze', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!response.ok) throw new Error('Server returned error status');
      console.log("Image sent successfully! Check your server terminal.");
      
    } catch (error) {
      console.error("Pipeline failure:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Fix: Using CameraView component wraps modern native structures cleanly */}
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        <TouchableOpacity style={styles.hugeButton} onPress={captureAndAnalyze}>
          {loading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>TAP ANYWHERE TO SCAN WORLD</Text>
          )}
        </TouchableOpacity>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  camera: { 
    flex: 1 
  },
  hugeButton: {
    flex: 1,
    backgroundColor: 'rgba(211, 47, 47, 0.25)', // Red transparency tint
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  buttonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#cc0000',
    padding: 20,
    borderRadius: 8,
    overflow: 'hidden'
  },
});