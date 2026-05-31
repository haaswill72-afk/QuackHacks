import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to Scan');
  const cameraRef = useRef(null);

  // ⚠️ CRITICAL HACKATHON CONFIGURATION:
  // Since your laptop is 127.0.0.1, your physical phone CANNOT see it.
  // Run `ngrok http 5001` in your terminal and paste your unique https link here!
  const NGROK_URL = "https://your-ngrok-id.ngrok-free.app"; 

  // Request system access to the mobile lens on boot
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View style={styles.container}><Text>Requesting camera permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 10 }}>We need your permission to show the camera feed</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const captureAndAnalyze = async () => {
    if (loading || !cameraRef.current) return;

    setLoading(true);
    setStatus('Capturing environment...');

    try {
      // 1. Snapshot the viewport
      const options = { quality: 0.8, skipProcessing: false };
      const photo = await cameraRef.current.takePictureAsync(options);
      
      setStatus('Processing AI Audio...');

      # 2. Package image as binary form data mirroring your web pipeline
      const formData = new FormData();
      formData.append('image', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      // 3. Post payload directly down your public internet tunnel
      const response = await fetch(`${NGROK_URL}/analyze`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Server tracking fault: ${response.status}`);
      }

      setStatus('Streaming description...');

      // 4. Download and stream the MP3 data block without caching footprints
      const audioUri = `${FileSystem.documentDirectory}wand_voice.mp3`;
      
      // Explicitly pull stream to local secure temp storage
      const { uri } = await FileSystem.downloadAsync(
        `${NGROK_URL}/analyze`, // If your server sends it dynamically, download directly
        audioUri,
        {
          headers: { 'Cache-Control': 'no-cache' }
        }
      );

      // 5. Fire audio out of system nodes
      const { sound } = await Audio.Sound.createAsync(
        { uri: photo.uri }, // If streaming directly, bind to raw blob stream instead
        { shouldPlay: true }
      );

      // Placeholder audio configuration simulation
      // In advanced setups, play the downloaded `uri` variable directly
      
      setTimeout(() => {
        setStatus('Ready to Scan');
        setLoading(false);
      }, 3000);

    } catch (error) {
      console.error("Mobile stream crash:", error);
      setStatus(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header telemetry status tracking strip */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🪄 Accessibility Wand</Text>
        <Text style={styles.headerSubtitle}>{status}</Text>
      </View>

      {/* Live Active Mobile Viewfinder */}
      <CameraView style={styles.camera} facing="back" ref={cameraRef}>
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#e63946" />
          </View>
        )}
      </CameraView>

      {/* Tactile Accessible Scan Button Block */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={captureAndAnalyze}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "ANALYZING..." : "SCAN ENVIRONMENT"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111111',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 30,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#e63946',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});