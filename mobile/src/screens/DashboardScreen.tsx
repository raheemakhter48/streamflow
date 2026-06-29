import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Image,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../context/AuthContext';
import {favoritesAPI, iptvAPI, recentlyWatchedAPI} from '../lib/api';
import {getCategories, parseM3U} from '../utils/m3uParser';
import {Channel, ContentType, Favorite, IptvRegion, RecentlyWatched} from '../types';
import ChannelCard from '../components/ChannelCard';
import {colors, radii} from '../theme';

type DashboardView = ContentType | 'home' | 'epg';

const features: Array<{
  id: Exclude<DashboardView, 'home'>;
  label: string;
  description: string;
  icon: string;
}> = [
  {id: 'live', label: 'LIVE TV', description: 'Watch Real-time', icon: 'television-classic'},
  {id: 'movie', label: 'MOVIES', description: 'Latest Cinema', icon: 'movie-open'},
  {id: 'series', label: 'SERIES', description: 'Binge Worthy', icon: 'view-grid'},
  {id: 'epg', label: 'EPG GUIDE', description: 'TV Schedule', icon: 'calendar-month'},
];

const mapRemoteChannel = (item: any): Channel | null => {
  const streams = Array.isArray(item.iptv_streams) ? item.iptv_streams : [];
  const stream = streams.find((entry: any) => entry?.url && entry?.is_working === true)
    || streams.find((entry: any) => entry?.url);
  if (!stream?.url) return null;

  return {
    name: item.name,
    url: stream.url,
    logo: item.logo_url,
    group: item.category || item.country || 'General',
    type: 'live',
    country: item.country,
    isWorking: stream.is_working === true || item.has_working_stream === true,
    isHD: String(stream.resolution || '').toUpperCase().includes('HD'),
    source: 'iptv-org',
    alternateUrls: streams.map((entry: any) => entry?.url).filter(Boolean),
  };
};

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {user, logout, isAuthenticated} = useAuth();
  const [viewMode, setViewMode] = useState<DashboardView>('home');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
  const [regions, setRegions] = useState<IptvRegion[]>([]);
  const [liveCategories, setLiveCategories] = useState<string[]>(['All']);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [livePage, setLivePage] = useState(1);
  const [liveTotalPages, setLiveTotalPages] = useState(1);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatched[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setIsLoading(true);

    try {
      const [credentials, favoriteList, watched, regionResponse] = await Promise.all([
        iptvAPI.getCredentials(),
        favoritesAPI.getFavorites(),
        recentlyWatchedAPI.getRecentlyWatched(),
        iptvAPI.getRegions().catch(() => ({data: []})),
      ]);
      const configured = Boolean(credentials.success && credentials.data);
      setHasCredentials(configured);
      setFavorites(new Set(favoriteList.map((item: Favorite) => item.channelUrl)));
      setRecentlyWatched(watched.slice(0, 10));
      setRegions(regionResponse.data || []);

      if (configured) {
        const playlist = await iptvAPI.getPlaylist();
        setChannels(playlist ? parseM3U(playlist) : []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    loadData();
  }, [isAuthenticated, loadData, navigation]);

  const selectedRegionCountries = useMemo(() => {
    return regions.find(region => region.code === selectedRegion)?.countries || [];
  }, [regions, selectedRegion]);

  useEffect(() => {
    if (viewMode !== 'live') return;
    const timer = setTimeout(async () => {
      setLiveLoading(true);
      try {
        const [channelResponse, categoryResponse] = await Promise.all([
          iptvAPI.getChannels({
            page: livePage,
            limit: 40,
            search: searchQuery.trim() || undefined,
            category: selectedCategory === 'All' ? undefined : selectedCategory,
            region: selectedRegion === 'All' ? undefined : selectedRegion,
            country: selectedCountry === 'All' ? undefined : selectedCountry,
          }),
          iptvAPI.getCategories({
            region: selectedRegion === 'All' ? undefined : selectedRegion,
            country: selectedCountry === 'All' ? undefined : selectedCountry,
          }),
        ]);
        const mapped = (channelResponse.data || []).map(mapRemoteChannel).filter(Boolean) as Channel[];
        setLiveChannels(current => livePage === 1 ? mapped : [
          ...current,
          ...mapped.filter(channel => !current.some(existing => existing.url === channel.url)),
        ]);
        setLiveTotalPages(channelResponse.totalPages || 1);
        setLiveCategories(categoryResponse.data || ['All']);
      } catch (error) {
        console.error('Error loading live channels:', error);
      } finally {
        setLiveLoading(false);
      }
    }, searchQuery ? 400 : 0);
    return () => clearTimeout(timer);
  }, [livePage, liveRefreshKey, searchQuery, selectedCategory, selectedCountry, selectedRegion, viewMode]);

  const categories = useMemo(() => {
    if (viewMode === 'live' && liveCategories.length) {
      return liveCategories;
    }
    const scoped = viewMode === 'live' || viewMode === 'movie' || viewMode === 'series'
      ? channels.filter(channel => channel.type === viewMode)
      : channels;
    return ['All', ...getCategories(scoped)];
  }, [channels, liveCategories, viewMode]);

  const filteredChannels = useMemo(() => {
    let result = viewMode === 'live' && liveChannels.length ? liveChannels : channels;
    if (viewMode === 'live' && liveChannels.length) {
      // Search/category filters were applied by the server.
    } else if (viewMode === 'live' || viewMode === 'movie' || viewMode === 'series') {
      result = result.filter(channel => channel.type === viewMode);
    }
    if (selectedCategory !== 'All' && !(viewMode === 'live' && liveChannels.length)) {
      result = result.filter(channel => channel.group === selectedCategory);
    }
    if (showFavoritesOnly) {
      result = result.filter(channel => favorites.has(channel.url));
    }
    const query = searchQuery.trim().toLowerCase();
    if (query && !(viewMode === 'live' && liveChannels.length)) {
      result = result.filter(channel =>
        channel.name.toLowerCase().includes(query) ||
        channel.group?.toLowerCase().includes(query),
      );
    }
    return result;
  }, [channels, favorites, liveChannels, searchQuery, selectedCategory, showFavoritesOnly, viewMode]);

  const openView = (view: DashboardView) => {
    setSelectedCategory('All');
    setSearchQuery('');
    setShowFavoritesOnly(false);
    setSelectedRegion('All');
    setSelectedCountry('All');
    setLivePage(1);
    setViewMode(view);
  };

  const toggleFavorite = async (channel: Channel) => {
    try {
      if (favorites.has(channel.url)) {
        await favoritesAPI.removeFavorite(channel.url);
        setFavorites(current => {
          const next = new Set(current);
          next.delete(channel.url);
          return next;
        });
      } else {
        await favoritesAPI.addFavorite({
          channelName: channel.name,
          channelUrl: channel.url,
          channelLogo: channel.logo || channel.tvgLogo,
          category: channel.group,
        });
        setFavorites(current => new Set(current).add(channel.url));
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update favorites');
    }
  };

  const renderHome = () => (
    <ScrollView
      contentContainerStyle={styles.homeContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />
      }>
      <View style={styles.heroHeader}>
        <View style={styles.brand}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.brandCopy}>
            <Text style={styles.brandTitle}>STREAM VAULT</Text>
            <View style={styles.welcomeRow}>
              <Icon name="account" size={15} color={colors.primary} />
              <Text style={styles.welcomeText}>
                Welcome back, <Text style={styles.welcomeName}>{user?.email?.split('@')[0] || 'Guest'}</Text>
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Setup')}>
            <Icon name="cog-outline" size={21} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
            <Icon name="tune-variant" size={21} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={logout}>
            <Icon name="logout" size={21} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.featureGrid}>
        {features.map(feature => (
          <TouchableOpacity
            key={feature.id}
            style={styles.featureCard}
            onPress={() => openView(feature.id)}
            activeOpacity={0.82}>
            <View style={styles.featureIcon}>
              <Icon name={feature.icon} size={34} color={colors.primary} />
            </View>
            <Text style={styles.featureTitle}>{feature.label}</Text>
            <Text style={styles.featureDescription}>{feature.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {recentlyWatched.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionIcon}>
              <Icon name="clock-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>RECENTLY VIEWED</Text>
          </View>
          <FlatList
            horizontal
            data={recentlyWatched}
            keyExtractor={(item, index) => `${item.channelUrl}-${index}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({item}) => {
              const channel = {
                name: item.channelName,
                url: item.channelUrl,
                logo: item.channelLogo,
                group: item.category,
              };
              return (
                <ChannelCard
                  channel={channel}
                  width={172}
                  isFavorite={favorites.has(item.channelUrl)}
                  onToggleFavorite={() => toggleFavorite(channel)}
                  onPress={() => navigation.navigate('Player', {channel})}
                />
              );
            }}
          />
        </View>
      )}
    </ScrollView>
  );

  const renderList = () => (
    <View style={styles.listView}>
      <View style={styles.listHeader}>
        <View style={styles.listTitleRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => openView('home')}>
            <Icon name="chevron-left" size={26} color={colors.textMuted} />
            <Text style={styles.backText}>BACK</Text>
          </TouchableOpacity>
          <Text style={styles.listTitle}>{viewMode.toUpperCase()}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, showFavoritesOnly && styles.favoriteActive]}
              onPress={() => setShowFavoritesOnly(value => !value)}>
              <Icon name="heart" size={20} color={showFavoritesOnly ? colors.text : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                loadData(true);
                setLivePage(1);
                setLiveRefreshKey(value => value + 1);
              }}>
              <Icon name="refresh" size={21} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {viewMode !== 'epg' && (
          <>
            <View style={styles.searchBox}>
              <Icon name="magnify" size={22} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for channels, movies, or series..."
                placeholderTextColor={colors.textDim}
                value={searchQuery}
                onChangeText={value => {
                  setSearchQuery(value);
                  setLivePage(1);
                }}
              />
            </View>
            {viewMode === 'live' && regions.length > 0 && (
              <>
                <Text style={styles.filterLabel}>REGION</Text>
                <FlatList
                  horizontal
                  data={[{code: 'All', name: 'All Regions', countries: []}, ...regions]}
                  keyExtractor={item => item.code}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryContent}
                  renderItem={({item}) => (
                    <TouchableOpacity
                      style={[styles.categoryButton, selectedRegion === item.code && styles.categoryActive]}
                      onPress={() => {
                        setSelectedRegion(item.code);
                        setSelectedCountry('All');
                        setSelectedCategory('All');
                        setLivePage(1);
                      }}>
                      <Text style={[styles.categoryText, selectedRegion === item.code && styles.categoryTextActive]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
                {selectedRegion !== 'All' && selectedRegionCountries.length > 0 && (
                  <>
                    <Text style={styles.filterLabel}>COUNTRY</Text>
                    <FlatList
                      horizontal
                      data={['All', ...selectedRegionCountries]}
                      keyExtractor={item => item}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryContent}
                      renderItem={({item}) => (
                        <TouchableOpacity
                          style={[styles.categoryButton, selectedCountry === item && styles.categoryActive]}
                          onPress={() => {
                            setSelectedCountry(item);
                            setSelectedCategory('All');
                            setLivePage(1);
                          }}>
                          <Text style={[styles.categoryText, selectedCountry === item && styles.categoryTextActive]}>
                            {item === 'All' ? 'All Countries' : item}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </>
                )}
                <Text style={styles.filterLabel}>CATEGORY</Text>
              </>
            )}
            <FlatList
              horizontal
              data={categories}
              keyExtractor={item => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryContent}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[styles.categoryButton, selectedCategory === item && styles.categoryActive]}
                  onPress={() => {
                    setSelectedCategory(item);
                    setLivePage(1);
                  }}>
                  <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </View>

      {viewMode === 'epg' ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Icon name="calendar-month" size={42} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>EPG GUIDE</Text>
          <Text style={styles.emptyText}>Programme schedule will appear here when your provider supplies EPG data.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChannels}
          numColumns={2}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          contentContainerStyle={styles.channelList}
          columnWrapperStyle={styles.channelRow}
          onEndReached={() => {
            if (viewMode === 'live' && !liveLoading && livePage < liveTotalPages) {
              setLivePage(page => page + 1);
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={liveLoading ? <ActivityIndicator style={styles.listLoader} color={colors.primary} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="television-off" size={42} color={colors.textDim} />
              <Text style={styles.emptyTitle}>NO CONTENT FOUND</Text>
              <Text style={styles.emptyText}>Try a different search or category.</Text>
            </View>
          }
          renderItem={({item}) => (
            <ChannelCard
              channel={item}
              isFavorite={favorites.has(item.url)}
              onToggleFavorite={() => toggleFavorite(item)}
              onPress={() => navigation.navigate('Player', {channel: item})}
            />
          )}
        />
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <View style={styles.loadingIcon}>
            <Icon name="lightning-bolt" size={44} color={colors.primary} />
          </View>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTitle}>POWERING UP VAULT</Text>
          <Text style={styles.loadingText}>Fetching your premium entertainment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasCredentials) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.setupState}>
          <View style={styles.loadingIcon}>
            <Icon name="television-classic" size={44} color={colors.primary} />
          </View>
          <Text style={styles.setupTitle}>READY TO <Text style={styles.cyan}>UNLOCK?</Text></Text>
          <Text style={styles.setupCopy}>Set up your IPTV credentials to access live channels, movies and series.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Setup')}>
            <Text style={styles.primaryButtonText}>SETUP IPTV</Text>
            <Icon name="arrow-right" size={20} color={colors.background} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {viewMode === 'home' ? renderHome() : renderList()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  homeContent: {padding: 18, paddingBottom: 42},
  heroHeader: {marginBottom: 28},
  brand: {flexDirection: 'row', alignItems: 'center'},
  logo: {width: 54, height: 54, marginRight: 12},
  brandCopy: {flex: 1},
  brandTitle: {color: colors.primary, fontSize: 28, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1},
  welcomeRow: {flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5},
  welcomeText: {color: colors.textMuted, fontSize: 13},
  welcomeName: {color: colors.text, fontWeight: '800'},
  quickActions: {flexDirection: 'row', gap: 8, marginTop: 16},
  iconButton: {flex: 1, height: 45, borderRadius: radii.small, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center'},
  featureGrid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  featureCard: {width: '48%', height: 174, marginBottom: 14, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center', padding: 12},
  featureIcon: {width: 66, height: 66, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.48)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 13},
  featureTitle: {color: colors.text, fontSize: 17, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1},
  featureDescription: {color: colors.textDim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 5},
  recentSection: {marginTop: 20},
  sectionHeading: {flexDirection: 'row', alignItems: 'center', marginBottom: 14},
  sectionIcon: {width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.borderCyan, backgroundColor: 'rgba(0,215,229,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 10},
  sectionTitle: {color: colors.text, fontSize: 19, fontWeight: '900', fontStyle: 'italic'},
  listView: {flex: 1},
  listHeader: {borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 14},
  listTitleRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15},
  backButton: {flexDirection: 'row', alignItems: 'center'},
  backText: {color: colors.textMuted, fontSize: 12, fontWeight: '900'},
  listTitle: {color: colors.primary, fontSize: 21, fontWeight: '900', fontStyle: 'italic', marginLeft: 10, flex: 1},
  headerActions: {flexDirection: 'row', gap: 7},
  headerButton: {width: 42, height: 42, borderRadius: radii.small, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center'},
  favoriteActive: {backgroundColor: colors.danger, borderColor: colors.danger},
  searchBox: {height: 54, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 15},
  searchInput: {flex: 1, color: colors.text, fontSize: 14, marginLeft: 9},
  categoryContent: {paddingHorizontal: 16, paddingTop: 12},
  filterLabel: {color: colors.textDim, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginLeft: 18, marginTop: 12},
  categoryButton: {paddingHorizontal: 17, paddingVertical: 10, borderRadius: 13, marginRight: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft},
  categoryActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  categoryText: {color: colors.text, fontSize: 11, fontWeight: '800'},
  categoryTextActive: {color: colors.background},
  channelList: {padding: 10, paddingBottom: 40},
  channelRow: {justifyContent: 'space-between'},
  listLoader: {marginVertical: 18},
  emptyState: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36},
  emptyIcon: {width: 82, height: 82, borderRadius: 28, borderWidth: 1, borderColor: colors.borderCyan, backgroundColor: 'rgba(0,215,229,0.07)', alignItems: 'center', justifyContent: 'center'},
  emptyTitle: {color: colors.text, fontSize: 20, fontWeight: '900', fontStyle: 'italic', marginTop: 18},
  emptyText: {color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8},
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30},
  loadingIcon: {width: 92, height: 92, borderRadius: 30, borderWidth: 1, borderColor: colors.borderCyan, backgroundColor: 'rgba(0,215,229,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 22},
  loadingTitle: {color: colors.text, fontSize: 22, fontWeight: '900', fontStyle: 'italic', marginTop: 18},
  loadingText: {color: colors.textMuted, marginTop: 7},
  setupState: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28},
  setupTitle: {color: colors.text, fontSize: 31, fontWeight: '900', fontStyle: 'italic', textAlign: 'center'},
  cyan: {color: colors.primary},
  setupCopy: {color: colors.textMuted, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 12, marginBottom: 28},
  primaryButton: {height: 58, borderRadius: 18, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 28},
  primaryButtonText: {color: colors.background, fontSize: 15, fontWeight: '900'},
});

export default DashboardScreen;
