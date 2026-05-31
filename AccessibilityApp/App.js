import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to Scan');
  const [audioUrl, setAudioUrl] = useState(null); // Tracks the streaming URL timestamp
  const [cameraReady, setCameraReady] = useState(false); 
  const cameraRef = useRef(null);

  // ⚠️ CRITICAL: Must match your active localtunnel address exactly!
  const TUNNEL_URL = "https://empty-birds-kiss.loca.lt"; 

  // Direct Network Stream Link: We append a random query parameter at the end (?t=...)
  // This forces Expo Go to instantly pull down a fresh live audio stream instead of using a broken local path object
  const player = useAudioPlayer(audioUrl ? `${TUNNEL_URL}/get_audio?t=${audioUrl}` : "");

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    if (audioUrl && player) {
      player.play();
      
      const subscription = player.addListener('playbackStatusUpdate', (statusData) => {
        if (statusData.didJustFinish) {
          setStatus('Ready to Scan');
          setLoading(false);
          setAudioUrl(null); // Clear stream source state
        }
      });
      return () => subscription.remove();
    }
  }, [audioUrl, player]);

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
    if (loading || !cameraRef.current || !cameraReady) {
      setStatus('Camera is not fully ready yet...');
      return;
    }

    setLoading(true);
    setStatus('Capturing environment...');

    try {
      console.log("📸 [DEBUG] Attempting to snap picture...");
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.8,
        skipProcessing: false
      });
      
      console.log("📸 [DEBUG] Camera returned photo object successfully.");

      if (!photo || !photo.uri) {
        throw new Error("The camera hardware returned an invalid photo asset.");
      }

      setStatus('Processing AI Audio...');

      const targetEndpoint = `${TUNNEL_URL}/analyze`;
      const dataPayload = new FormData();
      dataPayload.append('image', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      // Send the image down the tunnel to Gemini & ElevenLabs
      const response = await fetch(targetEndpoint, {
        method: 'POST',
        body: dataPayload,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned status code: ${response.status}`);
      }

      const resultJson = await response.json();
      console.log("🌐 [DEBUG] Server pipeline success confirmation:", resultJson);

      setStatus('Playing description...');
      
      // Update the state with a fresh timestamp to force the audio player hook to trigger streaming
      setAudioUrl(Date.now().toString());

    } catch (error) {
      console.error('Mobile stream crash:', error);
      setStatus(`Error: ${error?.message || 'Unknown camera error'}`);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🪄 Accessibility Text-To-Speech</Text>
        <Text style={styles.headerSubtitle}>{status}</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          ref={cameraRef}
          onCameraReady={() => setCameraReady(true)}
        />
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#4539e6" />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, (loading || !cameraReady) && styles.buttonDisabled]} 
          onPress={captureAndAnalyze}
          disabled={loading || !cameraReady}
        >
          <Text style={styles.buttonText}>
            {!cameraReady ? "WARMING UP..." : loading ? "ANALYZING..." : "SCAN ENVIRONMENT"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingTop: 60, paddingBottom: 20, backgroundColor: '#ffffff', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111111' },
  headerSubtitle: { fontSize: 14, color: '#666666', marginTop: 4, fontWeight: '600' },
  cameraContainer: { flex: 1, position: 'relative', backgroundColor: '#000000' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  footer: { padding: 30, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  button: { backgroundColor: '#e63946', padding: 20, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#cccccc' },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
});