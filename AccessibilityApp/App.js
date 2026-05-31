import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Directory } from 'expo-file-system'; 
import { useAudioPlayer } from 'expo-audio';

const SafeCameraView = React.forwardRef(({ onReady, style, facing }, ref) => {
  const [layoutReady, setLayoutReady] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);

  useEffect(() => {
    if (layoutReady && nativeReady) {
      onReady?.();
    }
  }, [layoutReady, nativeReady, onReady]);

  return (
    <View style={style} onLayout={() => setLayoutReady(true)}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        ref={ref}
        onCameraReady={() => setNativeReady(true)}
      />
    </View>
  );
});

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to Scan');
  const [audioSource, setAudioSource] = useState(null);
  const [cameraReady, setCameraReady] = useState(false); // New stability flag
  const cameraRef = useRef(null);

  const player = useAudioPlayer(audioSource);

  // ⚠️ Ensure this matches your active localtunnel/ngrok address string!
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
    const cameraInstance = cameraRef.current;
    const cameraAvailable = cameraInstance && typeof cameraInstance.takePictureAsync === 'function';

    if (loading) {
      return;
    }

    if (!cameraAvailable || !cameraReady) {
      setStatus('Camera is not fully ready yet. Please wait a moment.');
      return;
    }

    setLoading(true);
    setStatus('Capturing environment...');

    try {
      const options = { quality: 0.8, base64: false };
      const photo = await cameraInstance.takePictureAsync(options).catch((captureError) => {
        throw new Error(`Camera capture failed: ${captureError?.message || String(captureError)}`);
      });

      if (!photo || typeof photo !== 'object' || !photo.uri) {
        throw new Error('Camera capture did not return a valid image object.');
      }

      setStatus('Processing AI Audio...');

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
          Accept: 'audio/mpeg',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned status code: ${response.status}`);
      }

      setStatus('Streaming description...');
      const base64AudioData = await response.text().catch((readError) => {
        throw new Error(`Failed reading audio response: ${readError?.message || String(readError)}`);
      });

      const localAudioFile = new File(Directory.cache, 'wand_voice.mp3');
      await localAudioFile.writeAsStringAsync(base64AudioData, {
        encoding: 'base64',
      });

      setAudioSource(localAudioFile.uri);
    } catch (error) {
      console.error('Mobile stream crash:', error);
      setStatus(`Error: ${error?.message || 'Unknown camera error'}`);
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
        <SafeCameraView
          style={styles.camera}
          facing="back"
          ref={cameraRef}
          onReady={() => setCameraReady(true)}
        />
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#e63946" />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[
            styles.button, 
            (loading || !cameraReady) && styles.buttonDisabled
          ]} 
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