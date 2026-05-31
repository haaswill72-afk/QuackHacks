import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Directory } from 'expo-file-system'; 
import { useAudioPlayer } from 'expo-audio';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to Scan');
  const [audioSource, setAudioSource] = useState(null);
  const cameraRef = useRef(null);

  const player = useAudioPlayer(audioSource);

  // ⚠️ CRITICAL: Ensure this matches your active ngrok/localtunnel link!
  const NGROK_URL = "https://empty-birds-kiss.loca.lt"; 

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    if (audioSource && player) {
      player.play();
      
      const subscription = player.addListener('playbackStatusUpdate', (statusData) => {
        if (statusData.didJustFinish) {
          setStatus('Ready to Scan');
          setLoading(false);
          setAudioSource(null);
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
      const options = { quality: 0.85 };
      const photo = await cameraRef.current.takePictureAsync(options);
      
      setStatus('Processing AI Audio...');

      // 1. Send the file data package over the network tunnel using a standard fetch request
      const targetEndpoint = `${NGROK_URL}/analyze`;
      
      const dataPayload = new FormData();
      dataPayload.append('image', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(targetEndpoint, {
        method: 'POST',
        body: dataPayload,
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned status code: ${response.status}`);
      }

      setStatus('Streaming description...');

      // 2. Read response as text (Base64 string from your server)
      const base64AudioData = await response.text();

      // 3. Use the new SDK 54 File API to write the stream to the phone's cache directory
      const localAudioFile = new File(Directory.cache, 'wand_voice.mp3');
      await localAudioFile.writeAsStringAsync(base64AudioData, {
        encoding: 'base64',
      });

      // 4. Set the audio player source to the path of our new file
      setAudioSource(localAudioFile.uri);

    } catch (error) {
      console.error("Mobile stream crash:", error);
      setStatus(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🪄 Accessibility Wand</Text>
        <Text style={styles.headerSubtitle}>{status}</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="back" ref={cameraRef} />
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#e63946" />
          </View>
        )}
      </View>

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