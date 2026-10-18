import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  SafeAreaView,
  StatusBar
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

// Server Backend URL
// Cloudflare High-Speed Secure Tunnel (Accessible worldwide on any phone, Wi-Fi or 4G/5G)
const BACKEND_URL = 'https://annex-difference-resolutions-silly.trycloudflare.com';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && (text.includes('youtube.com') || text.includes('youtu.be'))) {
        setUrl(text.trim());
      } else {
        Alert.alert('تنبيه', 'لم يتم العثور على رابط يوتيوب في الحافظة.');
      }
    } catch (e) {
      console.log('Clipboard error:', e);
    }
  };

  // Fetch video information
  const handleFetchInfo = async () => {
    if (!url.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رابط يوتيوب أولاً.');
      return;
    }

    setLoading(true);
    setVideoData(null);
    setStatusMessage('جاري استخراج تفاصيل الفيديو...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const resJson = await response.json();

      if (response.ok && resJson.success) {
        setVideoData(resJson.data);
        setStatusMessage('');
      } else {
        Alert.alert('خطأ', resJson.error || 'تعذر جلب تفاصيل الفيديو.');
        setStatusMessage('');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      Alert.alert('خطأ في الاتصال', 'تأكد من تشغيل خادم الـ Backend على المنفذ 5000.');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  // Trigger download
  const handleDownload = (quality, type) => {
    if (!videoData) return;

    setDownloading(true);
    setDownloadProgress('جاري تحضير وبدء التحميل...');

    const downloadUrl = `${BACKEND_URL}/api/download?url=${encodeURIComponent(
      url.trim()
    )}&quality=${encodeURIComponent(quality || '')}&type=${type || 'video'}&title=${encodeURIComponent(
      videoData.title || 'video'
    )}`;

    if (Platform.OS === 'web') {
      // In Web browser environment, trigger download directly via hidden anchor
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${videoData.title}.${type === 'audio' ? 'mp3' : 'mp4'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress('تم بدء التحميل بنجاح!');
      }, 1500);
    } else {
      // In Mobile device (Expo Go / standalone), open the stream download via browser/native manager
      Linking.openURL(downloadUrl)
        .then(() => {
          setDownloading(false);
          setDownloadProgress('تم بدء التحميل في هاتفك بنجاح!');
        })
        .catch((err) => {
          setDownloading(false);
          Alert.alert('خطأ', 'تعذر فتح رابط التحميل.');
        });
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⚡ سريع & آمن 100%</Text>
          </View>
          <Text style={styles.title}>DownloadEverything</Text>
          <Text style={styles.subtitle}>حمل فيديوهات ومقاطع يوتيوب بأعلى جودة وصوت MP3 بنقرة واحدة</Text>
        </View>

        {/* Input Card */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>ضع رابط يوتيوب هنا:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="https://www.youtube.com/watch?v=..."
              placeholderTextColor="#64748b"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
              <Text style={styles.pasteButtonText}>لصق</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.fetchButton, loading && styles.buttonDisabled]}
            onPress={handleFetchInfo}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.fetchButtonText}>🔍 استخراج الفيديو والخيارات</Text>
            )}
          </TouchableOpacity>

          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
        </View>

        {/* Video Preview & Options Card */}
        {videoData && (
          <View style={styles.videoCard}>
            {videoData.thumbnail ? (
              <View style={styles.thumbnailContainer}>
                <Image source={{ uri: videoData.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{videoData.duration}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.videoMeta}>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {videoData.title}
              </Text>
              <Text style={styles.videoAuthor}>👤 {videoData.author}</Text>
            </View>

            {/* Quality Options Section */}
            <Text style={styles.sectionHeader}>📹 خيارات تحميل الفيديو (MP4):</Text>
            <View style={styles.optionsGrid}>
              {videoData.videoOptions && videoData.videoOptions.length > 0 ? (
                videoData.videoOptions.map((opt, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.optionButton}
                    onPress={() => handleDownload(opt.quality, 'video')}
                    disabled={downloading}
                  >
                    <Text style={styles.optionQuality}>{opt.quality}</Text>
                    <Text style={styles.optionFormat}>MP4 • فيديو</Text>
                    <View style={styles.downloadIconBadge}>
                      <Text style={styles.downloadIconText}>تحميل ⬇</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => handleDownload('best', 'video')}
                  disabled={downloading}
                >
                  <Text style={styles.optionQuality}>أفضل جودة متاحة</Text>
                  <Text style={styles.optionFormat}>MP4</Text>
                  <Text style={styles.downloadIconText}>تحميل ⬇</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Audio Option Section */}
            <Text style={styles.sectionHeader}>🎵 خيار الصوت فقط (MP3):</Text>
            <TouchableOpacity
              style={styles.audioOptionButton}
              onPress={() => handleDownload('bestaudio', 'audio')}
              disabled={downloading}
            >
              <View>
                <Text style={styles.audioOptionTitle}>مقطع صوتي عالي النقاء</Text>
                <Text style={styles.audioOptionSub}>صيغة MP3 • تشغيل في الخلفية</Text>
              </View>
              <View style={styles.audioBadge}>
                <Text style={styles.audioBadgeText}>تحميل MP3 🎵</Text>
              </View>
            </TouchableOpacity>

            {downloadProgress ? (
              <View style={styles.downloadStatusCard}>
                <Text style={styles.downloadStatusText}>{downloadProgress}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Features / Safety Guarantee Footer */}
        <View style={styles.footerNote}>
          <Text style={styles.footerTitle}>🔒 آمن 100% وبدون إعلانات</Text>
          <Text style={styles.footerDesc}>
            يتم الاتصال مباشرة واستخراج التحميل بشكل مشفر وسريع دون إدخال أي برمجيات أو إعلانات مزعجة.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  badge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 12,
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 320,
  },
  card: {
    backgroundColor: '#131b2e',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0f1d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26334d',
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 14,
    textAlign: 'left',
  },
  pasteButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pasteButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  fetchButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  fetchButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  videoCard: {
    backgroundColor: '#131b2e',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 25,
  },
  thumbnailContainer: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0a0f1d',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  videoMeta: {
    marginTop: 14,
    marginBottom: 16,
  },
  videoTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'right',
  },
  videoAuthor: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'right',
  },
  sectionHeader: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 10,
    textAlign: 'right',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  optionButton: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionQuality: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '900',
  },
  optionFormat: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  downloadIconBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  downloadIconText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  audioOptionButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  audioOptionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  audioOptionSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  audioBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  audioBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  downloadStatusCard: {
    marginTop: 15,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#38bdf8',
    alignItems: 'center',
  },
  downloadStatusText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  footerNote: {
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  footerTitle: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  footerDesc: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
