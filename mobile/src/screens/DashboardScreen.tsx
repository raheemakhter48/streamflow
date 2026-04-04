import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../context/AuthContext';
import {iptvAPI, favoritesAPI, recentlyWatchedAPI} from '../lib/api';
import {parseM3U, getCategories} from '../utils/m3uParser';
import {Channel, Favorite, ContentType} from '../types';
import ChannelCard from '../components/ChannelCard';

const {width, height} = Dimensions.get('window');

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const {user, logout, isAuthenticated} = useAuth();
  const [viewMode, setViewMode] = useState<ContentType | 'home' | 'epg'>('home');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyWatched, setRecentlyWatched] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const channelsPerPage = 40;

  // Figma Neon Theme
  const primaryCyan = '#00D7E5';
  const secondaryCyan = '#00A8B5';
  const blackBg = '#000000';

  useEffect(() => {
    if (!isAuthenticated) {
      (navigation as any).navigate('Auth');
      return;
    }
    loadData();
  }, [isAuthenticated]);

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const [credentialsData, favoritesData, watchedData] = await Promise.all([
        iptvAPI.getCredentials(),
        favoritesAPI.getFavorites(),
        recentlyWatchedAPI.getRecentlyWatched(),
      ]);

      if (credentialsData.success) {
        await parseM3UPlaylist();
      }

      const favoriteUrls = new Set<string>(favoritesData.map((f: Favorite) => f.channelUrl));
      setFavorites(favoriteUrls);
      setRecentlyWatched(watchedData.slice(0, 10));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const parseM3UPlaylist = async () => {
    try {
      const text = await iptvAPI.getPlaylist();
      if (text) {
        const parsedChannels = parseM3U(text);
        setChannels(parsedChannels);
        setFilteredChannels(parsedChannels);
      }
    } catch (error) {
      console.error('Error parsing M3U:', error);
    }
  };

  const categories = useMemo(() => {
    const filteredForMode = viewMode === 'home' || viewMode === 'epg' 
      ? channels 
      : channels.filter(ch => ch.type === viewMode);
    return ['All', ...getCategories(filteredForMode)];
  }, [channels, viewMode]);

  const filterChannels = useCallback(() => {
    let filtered = [...channels];
    
    if (viewMode !== 'home' && viewMode !== 'epg') {
      filtered = filtered.filter(ch => ch.type === viewMode);
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(ch => ch.group === selectedCategory);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(ch => 
        ch.name.toLowerCase().includes(lowerQuery) || 
        (ch.group && ch.group.toLowerCase().includes(lowerQuery))
      );
    }
    setFilteredChannels(filtered);
    setCurrentPage(1);
  }, [channels, selectedCategory, searchQuery, viewMode]);

  useEffect(() => {
    filterChannels();
  }, [selectedCategory, searchQuery, viewMode, filterChannels]);

  const paginatedChannels = useMemo(() => {
    return filteredChannels.slice(0, currentPage * channelsPerPage);
  }, [filteredChannels, currentPage]);

  const renderHomeMode = () => (
    <View style={styles.homeContainer}>
      {/* Background Glows */}
      <View style={styles.glowContainer}>
        <View style={styles.topGlow} />
      </View>

      <View style={styles.topHeader}>
        <View style={styles.brandingContainer}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.headerLogo} 
            resizeMode="contain" 
          />
          <View>
            <Text style={styles.welcomeText}>STREAM VAULT</Text>
            <Text style={styles.userNameText}>{user?.email?.split('@')[0] || 'GUEST'}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => (navigation as any).navigate('Setup')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.smartersGrid}>
        <TouchableOpacity style={styles.gridItem} onPress={() => setViewMode('live')}>
          <View style={styles.gridCard}>
            <View style={styles.gridIconContainer}>
              <Text style={styles.gridEmoji}>📺</Text>
            </View>
            <Text style={styles.gridText}>LIVE TV</Text>
            <Text style={styles.gridSubText}>REAL-TIME</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.gridItem} onPress={() => setViewMode('movie')}>
          <View style={styles.gridCard}>
            <View style={styles.gridIconContainer}>
              <Text style={styles.gridEmoji}>🎬</Text>
            </View>
            <Text style={styles.gridText}>MOVIES</Text>
            <Text style={styles.gridSubText}>CINEMA</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.gridItem} onPress={() => setViewMode('series')}>
          <View style={styles.gridCard}>
            <View style={styles.gridIconContainer}>
              <Text style={styles.gridEmoji}>🎭</Text>
            </View>
            <Text style={styles.gridText}>SERIES</Text>
            <Text style={styles.gridSubText}>BINGE</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.gridItem} onPress={() => setViewMode('epg')}>
          <View style={styles.gridCard}>
            <View style={styles.gridIconContainer}>
              <Text style={styles.gridEmoji}>📅</Text>
            </View>
            <Text style={styles.gridText}>EPG GUIDE</Text>
            <Text style={styles.gridSubText}>SCHEDULE</Text>
          </View>
        </TouchableOpacity>
      </View>

      {recentlyWatched.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>CONTINUE WATCHING</Text>
          <FlatList
            horizontal
            data={recentlyWatched}
            renderItem={({item}) => (
              <View style={{marginRight: 15}}>
                <ChannelCard
                  channel={{name: item.channelName, url: item.channelUrl, logo: item.channelLogo, group: item.category}}
                  isFavorite={favorites.has(item.channelUrl)}
                  onPress={() => (navigation as any).navigate('Player', {channel: {name: item.channelName, url: item.channelUrl, logo: item.channelLogo, group: item.category}})}
                />
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutBtnText}>LOGOUT SESSION</Text>
      </TouchableOpacity>
    </View>
  );

  const renderListView = () => (
    <View style={styles.listView}>
      <View style={styles.listHeader}>
        <TouchableOpacity onPress={() => setViewMode('home')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.listTitle}>{viewMode.toUpperCase()}</Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="SEARCH VAULT..."
          placeholderTextColor="#444"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={categories}
        horizontal
        style={styles.categoryList}
        renderItem={({item}) => (
          <TouchableOpacity 
            onPress={() => setSelectedCategory(item)}
            style={[styles.categoryBtn, selectedCategory === item && {backgroundColor: primaryCyan}]}>
            <Text style={[styles.categoryText, selectedCategory === item && {color: '#000'}]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={paginatedChannels}
        numColumns={3}
        key={viewMode}
        renderItem={({item}) => (
          <ChannelCard
            channel={item}
            isFavorite={favorites.has(item.url)}
            onPress={() => (navigation as any).navigate('Player', {channel: item})}
          />
        )}
        onEndReached={() => setCurrentPage(p => p + 1)}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={blackBg} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primaryCyan} />
          <Text style={styles.loadingText}>INITIALIZING VAULT...</Text>
        </View>
      ) : (
        viewMode === 'home' ? renderHomeMode() : renderListView()
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: 'rgba(0, 215, 229, 0.05)',
    borderRadius: width * 0.4,
  },
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {color: '#00D7E5', marginTop: 15, fontSize: 12, fontWeight: '900', letterSpacing: 2},
  homeContainer: {flex: 1, padding: 25},
  topHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40},
  brandingContainer: {flexDirection: 'row', alignItems: 'center'},
  headerLogo: {
    width: 50,
    height: 50,
    marginRight: 15,
  },
  logoCircleGradient: {width: 55, height: 55, borderRadius: 18, padding: 2, marginRight: 15},
  logoCircle: {flex: 1, backgroundColor: '#000', borderRadius: 16, justifyContent: 'center', alignItems: 'center'},
  logoInitials: {fontSize: 22, fontWeight: '900', color: '#fff', fontStyle: 'italic'},
  welcomeText: {color: '#00D7E5', fontSize: 10, fontWeight: '900', letterSpacing: 2},
  userNameText: {color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5},
  settingsButton: {padding: 10},
  settingsIcon: {fontSize: 24},
  smartersGrid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  gridItem: {width: '48%', height: 160, marginBottom: 15},
  gridCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  gridIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  gridEmoji: {fontSize: 28},
  gridText: {color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1, fontStyle: 'italic'},
  gridSubText: {color: '#444', fontSize: 8, fontWeight: '900', letterSpacing: 2, marginTop: 4},
  historySection: {marginTop: 30},
  sectionTitle: {color: '#00D7E5', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 20},
  logoutBtn: {marginTop: 'auto', alignSelf: 'center', padding: 20},
  logoutBtnText: {color: '#333', fontSize: 10, fontWeight: '900', letterSpacing: 2},
  listView: {flex: 1},
  listHeader: {flexDirection: 'row', alignItems: 'center', padding: 25},
  backBtn: {marginRight: 20},
  backBtnText: {color: '#00D7E5', fontSize: 14, fontWeight: '900', letterSpacing: 1},
  listTitle: {color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -1, fontStyle: 'italic'},
  searchBar: {paddingHorizontal: 25, marginBottom: 20},
  searchInput: {backgroundColor: 'rgba(255, 255, 255, 0.03)', color: '#fff', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)'},
  categoryList: {maxHeight: 55, marginBottom: 15, paddingLeft: 25},
  categoryBtn: {paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15, marginRight: 10, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)'},
  categoryText: {color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1},
  listContainer: {padding: 10, paddingBottom: 100},
});

export default DashboardScreen;
