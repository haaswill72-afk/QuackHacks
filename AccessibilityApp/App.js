import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useAudioPlayer } from 'expo-audio';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to Scan');
  const [audioSource, setAudioSource] = useState(null);
  const cameraRef = useRef(null);

  // Initialize the native Expo Audio player node dynamically tied to state
  const player = useAudioPlayer(audioSource);

  // ⚠️ UPDATE THIS WITH YOUR ACTIVE NGROK LINK!
  const NGROK_URL = "https://empty-birds-kiss.loca.lt"; 

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  // Handle playing the stream whenever the local source updates
  useEffect(() => {
    if (audioSource && player) {
      player.play();
      
      // Reset status once audio finishes playing
      const subscription = player.addListener('playbackStatusUpdate', (statusData) => {
        if (statusData.didJustFinish) {
          setStatus('Ready to Scan');
          setLoading(false);
          setAudioSource(null); // Clear buffer source
        }
      });
      return () => subscription.remove();
    }
  }, [audioSource, player]);

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
      // 1. Snapshot the mobile camera frame layout view
      const options = { quality: 0.85 };
      const photo = await cameraRef.current.takePictureAsync(options);
      
      setStatus('Processing AI Audio...');

      // 2. Correctly initialize FormData structure
      const dataPayload = new FormData();
      dataPayload.append('image', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      // 3. Post down the ngrok tunnel directly to server.py
      const response = await fetch(`${NGROK_URL}/analyze`, {
        method: 'POST',
        body: dataPayload,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Server tracking fault: ${response.status}`);
      }

      setStatus('Streaming description...');

      // 4. Download file securely using FileSystem to local sandbox document directory
      const localAudioUri = `${FileSystem.documentDirectory}wand_voice.mp3`;
      
      await FileSystem.downloadAsync(
        `${NGROK_URL}/analyze`,
        localAudioUri,
        { headers: { 'Cache-Control': 'no-cache' } }
      );

      // 5. Update source to kick off the player useEffect hook loop
      setAudioSource(localAudioUri);

    } catch (error) {
      console.error("Mobile stream crash:", error);
      setStatus(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header telemetry strip */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🪄 Accessibility Wand</Text>
        <Text style={styles.headerSubtitle}>{status}</Text>
      </View>

      {/* Main Viewport Container */}
      <View style={styles.cameraContainer}>
        {/* Self-closing CameraView prevents layout children children glitches */}
        <CameraView style={styles.camera} facing="back" ref={cameraRef} />
        
        {/* Loading Spinner layered safely on top using absolute layouts */}
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#e63946" />
          </View>
        )}
      </View>

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
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
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