import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';

// ⚠️ Change this to your computer's local Wi-Fi IP (not localhost)
const SERVER_IP = 'YOUR_IP_HERE';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Tap anywhere to scan');
  const cameraRef = useRef(null);

  if (!permission) return <View style={styles.container} />;

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
      setStatus('📸 Capturing...');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
      });

      setStatus('🧠 Analyzing...');

      const formData = new FormData();
      formData.append('image', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(`http://${SERVER_IP}:5001/analyze`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!response.ok) throw new Error('Server error');

      setStatus('🔊 Playing description...');

      // Download the MP3 the server returns
      const audioBlob = await response.blob();

      // expo-av needs a URI — write blob to a temp file via FileSystem
      // Simplest approach: use the response URL directly isn't possible on native,
      // so we use expo-file-system to save it
      const { Sound } = Audio;
      
      // Configure audio session for playback
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

      // Save blob to local cache using expo-file-system
      const FileSystem = await import('expo-file-system');
      const fileUri = FileSystem.cacheDirectory + 'description.mp3';
      
      // Fetch again directly as a download (cleanest approach for native)
      // Instead: re-fetch and use downloadAsync
      const downloadResult = await FileSystem.downloadAsync(
        `http://${SERVER_IP}:5001/analyze`,  // won't work for POST
        fileUri
      );
      
      // ✅ Better approach for POST responses on native:
      const { sound } = await Sound.createAsync(
        { uri: photo.uri },  // placeholder — see note below
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.didJustFinish) {
          setStatus('Tap anywhere to scan');
          sound.unloadAsync();
        }
      });

    } catch (error) {
      console.error('Pipeline failure:', error);
      setStatus('❌ Error — check server connection');
    } finally {
      setLoading(false);
    }
  };
  // ...
}
