import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {iptvAPI} from '../lib/api';
import {useAuth} from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors} from '../theme';

const {width} = Dimensions.get('window');

const SetupScreen: React.FC = () => {
  const navigation = useNavigation();
  const {isAuthenticated} = useAuth();
  const [activeTab, setActiveTab] = useState<'m3u' | 'xtream' | 'paste'>('m3u');
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [providerName, setProviderName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [m3uContent, setM3uContent] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Auth' as never);
      return;
    }
    loadCredentials();
  }, [isAuthenticated]);

  const loadCredentials = async () => {
    try {
      const result = await iptvAPI.getCredentials();
      if (result.success && result.data) {
        const creds = result.data;
        setProviderName(creds.provider_name || '');
        setServerUrl(creds.server_url || '');
        setM3uUrl(creds.m3u_url || '');
        setEpgUrl(creds.epg_url || '');
        // Password and username are sensitive, we don't pre-fill password usually
        setUsername(creds.username || '');
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: any = {
        providerName: providerName.trim(),
        epgUrl: epgUrl.trim(),
      };

      if (activeTab === 'm3u') {
        if (!m3uUrl.trim()) throw new Error('M3U URL is required');
        payload.m3uUrl = m3uUrl.trim();
      } else if (activeTab === 'xtream') {
        if (!serverUrl.trim() || !username.trim() || !password.trim()) {
          throw new Error('All Xtream fields are required');
        }
        payload.serverUrl = serverUrl.trim();
        payload.username = username.trim();
        payload.password = password.trim();
      } else {
        if (!m3uContent.trim()) throw new Error('M3U Content is required');
        payload.m3uContent = m3uContent.trim();
      }

      const result = await iptvAPI.saveCredentials(payload);
      if (result.success) {
        Alert.alert('Success', 'IPTV Setup Completed!', [
          {text: 'Go to Dashboard', onPress: () => navigation.navigate('Dashboard' as never)},
        ]);
      } else {
        throw new Error(result.message || 'Failed to save');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, value: string, setter: (v: string) => void, placeholder: string, secure = false) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setter}
        placeholder={placeholder}
        placeholderTextColor="#555"
        secureTextEntry={secure}
        autoCapitalize="none"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevron-left" size={27} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>SETUP YOUR PLAYLIST</Text>
            <Text style={styles.subtitle}>Enter your IPTV provider details below</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          {[
            {id: 'm3u', label: 'M3U URL'},
            {id: 'xtream', label: 'XTREAM CODES'},
            {id: 'paste', label: 'PASTE M3U'},
          ].map(tab => (
            <TouchableOpacity 
              key={tab.id}
              onPress={() => setActiveTab(tab.id as any)}
              style={[styles.tab, activeTab === tab.id && {borderBottomColor: colors.primary}]}>
              <Text style={[styles.tabText, activeTab === tab.id && {color: colors.primary}]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.form}>
          {renderInput('PROVIDER NAME', providerName, setProviderName, 'e.g. My Premium IPTV')}
          
          {activeTab === 'm3u' && (
            <>
              {renderInput('M3U URL', m3uUrl, setM3uUrl, 'http://server.com/get.php?user=...')}
              {renderInput('EPG URL (OPTIONAL)', epgUrl, setEpgUrl, 'http://server.com/xmltv.php?user=...')}
            </>
          )}

          {activeTab === 'xtream' && (
            <>
              {renderInput('SERVER URL', serverUrl, setServerUrl, 'http://iptv-server.com:8080')}
              <View style={styles.row}>
                <View style={{flex: 1, marginRight: 10}}>
                  {renderInput('USERNAME', username, setUsername, 'Username')}
                </View>
                <View style={{flex: 1}}>
                  {renderInput('PASSWORD', password, setPassword, 'Password', true)}
                </View>
              </View>
              {renderInput('EPG URL (OPTIONAL)', epgUrl, setEpgUrl, 'Custom EPG Link')}
            </>
          )}

          {activeTab === 'paste' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>M3U CONTENT</Text>
              <TextInput
                style={[styles.input, {height: 150, textAlignVertical: 'top'}]}
                multiline
                value={m3uContent}
                onChangeText={setM3uContent}
                placeholder="#EXTM3U..."
                placeholderTextColor="#555"
              />
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.btnGradient}>
              {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.btnText}>CONNECT NOW</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scrollContent: {padding: 18, paddingBottom: 40},
  header: {marginBottom: 26, flexDirection: 'row', alignItems: 'center'},
  backButton: {width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12},
  headerCopy: {flex: 1},
  title: {color: colors.text, fontSize: 22, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5},
  subtitle: {color: colors.textMuted, fontSize: 13, marginTop: 4},
  tabBar: {flexDirection: 'row', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.border},
  tab: {flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent'},
  tabText: {color: colors.textDim, fontSize: 11, fontWeight: 'bold'},
  form: {backgroundColor: colors.surfaceSoft, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.border},
  inputGroup: {marginBottom: 20},
  label: {color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8},
  input: {backgroundColor: 'rgba(0,0,0,0.5)', color: colors.text, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: colors.border},
  row: {flexDirection: 'row'},
  saveBtn: {marginTop: 10, borderRadius: 16, overflow: 'hidden'},
  btnGradient: {padding: 18, alignItems: 'center'},
  btnText: {color: colors.background, fontSize: 16, fontWeight: '900', letterSpacing: 0.5},
  cancelBtn: {marginTop: 20, alignItems: 'center'},
  cancelText: {color: colors.textMuted, fontSize: 14},
});

export default SetupScreen;
