import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {useNavigation, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import VideoPlayer from '../components/VideoPlayer';
import {favoritesAPI, recentlyWatchedAPI, streamAPI} from '../lib/api';
import {Channel} from '../types';
import {colors, radii} from '../theme';

const PlayerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {channel} = route.params as {channel: Channel};
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    favoritesAPI.getFavorites()
      .then(items => setIsFavorite(items.some((item: any) => item.channelUrl === channel.url)))
      .catch(console.error);
    recentlyWatchedAPI.addRecentlyWatched({
      channelName: channel.name,
      channelUrl: channel.url,
      channelLogo: channel.logo || channel.tvgLogo,
      category: channel.group,
    }).catch(console.error);
  }, [channel]);

  const toggleFavorite = async () => {
    setLoading(true);
    try {
      if (isFavorite) {
        await favoritesAPI.removeFavorite(channel.url);
      } else {
        await favoritesAPI.addFavorite({
          channelName: channel.name,
          channelUrl: channel.url,
          channelLogo: channel.logo || channel.tvgLogo,
          category: channel.group,
        });
      }
      setIsFavorite(value => !value);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update favorite');
    } finally {
      setLoading(false);
    }
  };

  const resolveStream = async () => {
    const resolved = await streamAPI.resolveUrl(channel.url);
    return resolved.success && resolved.finalUrl ? resolved.finalUrl : channel.url;
  };

  const openInVLC = async () => {
    try {
      const url = await resolveStream();
      await Linking.openURL(`vlc://${url}`);
    } catch {
      Alert.alert('VLC not available', 'Install VLC Player or copy the stream URL.', [
        {text: 'Copy URL', onPress: () => copyUrl()},
        {text: 'OK'},
      ]);
    }
  };

  const openInMXPlayer = async () => {
    try {
      const url = await resolveStream();
      await Linking.openURL(`intent:${url}#Intent;scheme=http;package=com.mxtech.videoplayer.ad;end`);
    } catch {
      Alert.alert('MX Player not available', 'Install MX Player and try again.');
    }
  };

  const copyUrl = () => {
    Clipboard.setString(channel.url);
    Alert.alert('Copied', 'Stream URL copied to clipboard.');
  };

  const logo = channel.logo || channel.tvgLogo;

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.videoContainer}>
        <VideoPlayer
          streamUrl={channel.url}
          channelName={channel.name}
          onError={message => Alert.alert('Stream error', message)}
        />
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.channelHeader}>
          {!!logo && <Image source={{uri: logo}} style={styles.logo} />}
          <View style={styles.titleCopy}>
            <Text style={styles.channelName}>{channel.name}</Text>
            {!!channel.group && <Text style={styles.category}>{channel.group}</Text>}
          </View>
          <TouchableOpacity
            style={[styles.favoriteButton, isFavorite && styles.favoriteActive]}
            disabled={loading}
            onPress={toggleFavorite}>
            <Icon
              name={isFavorite ? 'star' : 'star-outline'}
              size={25}
              color={isFavorite ? colors.background : colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.recommendation}>
          <Icon name="television-play" size={23} color={colors.success} />
          <View style={styles.recommendationCopy}>
            <Text style={styles.recommendationTitle}>Best playback experience</Text>
            <Text style={styles.recommendationText}>
              If the in-app player cannot open this stream format, use VLC Player.
            </Text>
          </View>
        </View>

        <Text style={styles.actionsTitle}>OPEN IN EXTERNAL PLAYER</Text>
        <TouchableOpacity style={styles.primaryAction} onPress={openInVLC}>
          <Icon name="television-play" size={21} color={colors.background} />
          <Text style={styles.primaryActionText}>Open in VLC</Text>
        </TouchableOpacity>
        {Platform.OS === 'android' && (
          <TouchableOpacity style={styles.primaryAction} onPress={openInMXPlayer}>
            <Icon name="play-box-outline" size={21} color={colors.background} />
            <Text style={styles.primaryActionText}>Open in MX Player</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryAction} onPress={copyUrl}>
          <Icon name="content-copy" size={20} color={colors.text} />
          <Text style={styles.secondaryActionText}>Copy Stream URL</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  videoContainer: {width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.background},
  backButton: {position: 'absolute', left: 14, top: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center'},
  content: {padding: 18, paddingBottom: 42},
  channelHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 20},
  logo: {width: 66, height: 66, borderRadius: 15, backgroundColor: colors.surface, marginRight: 12},
  titleCopy: {flex: 1},
  channelName: {color: colors.text, fontSize: 21, fontWeight: '900'},
  category: {color: colors.textMuted, fontSize: 13, marginTop: 5},
  favoriteButton: {width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center', marginLeft: 10},
  favoriteActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  recommendation: {flexDirection: 'row', borderRadius: radii.medium, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.08)', padding: 15, marginBottom: 25},
  recommendationCopy: {flex: 1, marginLeft: 10},
  recommendationTitle: {color: colors.success, fontWeight: '900', fontSize: 14},
  recommendationText: {color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3},
  actionsTitle: {color: colors.text, fontSize: 16, fontWeight: '900', fontStyle: 'italic', marginBottom: 13},
  primaryAction: {height: 56, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 11},
  primaryActionText: {color: colors.background, fontSize: 15, fontWeight: '900'},
  secondaryAction: {height: 56, borderRadius: 16, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9},
  secondaryActionText: {color: colors.text, fontSize: 15, fontWeight: '800'},
});

export default PlayerScreen;
