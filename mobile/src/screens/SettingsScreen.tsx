import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {colors, radii} from '../theme';

type PlayerType = 'auto' | 'native' | 'external';

const playerOptions: Array<{id: PlayerType; title: string; description: string}> = [
  {id: 'auto', title: 'Auto (Recommended)', description: 'Automatically choose the best player for each stream'},
  {id: 'native', title: 'Native Player', description: 'Play compatible streams inside Stream Vault'},
  {id: 'external', title: 'External Player', description: 'Prefer VLC or MX Player for IPTV streams'},
];

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [playerType, setPlayerType] = useState<PlayerType>('auto');
  const [useProxy, setUseProxy] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('preferred_player'),
      AsyncStorage.getItem('use_proxy'),
    ]).then(([savedPlayer, savedProxy]) => {
      if (savedPlayer === 'auto' || savedPlayer === 'native' || savedPlayer === 'external') {
        setPlayerType(savedPlayer);
      }
      setUseProxy(savedProxy !== 'false');
    });
  }, []);

  const save = async () => {
    await AsyncStorage.multiSet([
      ['preferred_player', playerType],
      ['use_proxy', String(useProxy)],
    ]);
    Alert.alert('Settings saved', 'Your player preferences have been updated.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
          <Icon name="tune-variant" size={27} color={colors.primary} />
          <Text style={styles.title}>SETTINGS</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <Icon name="play-circle-outline" size={24} color={colors.primary} />
            <View>
              <Text style={styles.cardTitle}>PLAYER PREFERENCES</Text>
              <Text style={styles.cardDescription}>Choose how streams should open</Text>
            </View>
          </View>
          {playerOptions.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[styles.option, playerType === option.id && styles.optionActive]}
              onPress={() => setPlayerType(option.id)}>
              <View style={[styles.radio, playerType === option.id && styles.radioActive]}>
                {playerType === option.id && <View style={styles.radioDot} />}
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <Icon name="shield-lock-outline" size={24} color={colors.primary} />
            <View>
              <Text style={styles.cardTitle}>NETWORK & PRIVACY</Text>
              <Text style={styles.cardDescription}>Control how streams are loaded</Text>
            </View>
          </View>
          <View style={styles.proxyRow}>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>Use Stream Proxy</Text>
              <Text style={styles.optionDescription}>Improve compatibility with restricted IPTV streams</Text>
            </View>
            <Switch
              value={useProxy}
              onValueChange={setUseProxy}
              trackColor={{false: colors.textDim, true: colors.primaryDark}}
              thumbColor={useProxy ? colors.primary : '#D1D5DB'}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={save}>
          <Text style={styles.primaryButtonText}>SAVE SETTINGS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Setup')}>
          <Icon name="playlist-cog" size={20} color={colors.text} />
          <Text style={styles.secondaryButtonText}>IPTV CREDENTIALS</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: 18, paddingBottom: 40},
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 24},
  backButton: {width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12},
  title: {color: colors.text, fontSize: 25, fontWeight: '900', fontStyle: 'italic', marginLeft: 9},
  card: {borderRadius: radii.medium, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, padding: 16, marginBottom: 16},
  cardHeading: {flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16},
  cardTitle: {color: colors.text, fontSize: 16, fontWeight: '900'},
  cardDescription: {color: colors.textMuted, fontSize: 12, marginTop: 3},
  option: {flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 9},
  optionActive: {borderColor: colors.borderCyan, backgroundColor: 'rgba(0,215,229,0.05)'},
  radio: {width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textDim, alignItems: 'center', justifyContent: 'center', marginRight: 12},
  radioActive: {borderColor: colors.primary},
  radioDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary},
  optionCopy: {flex: 1},
  optionTitle: {color: colors.text, fontSize: 14, fontWeight: '800'},
  optionDescription: {color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3},
  proxyRow: {flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14},
  primaryButton: {height: 58, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4},
  primaryButtonText: {color: colors.background, fontSize: 15, fontWeight: '900'},
  secondaryButton: {height: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 12},
  secondaryButtonText: {color: colors.text, fontSize: 14, fontWeight: '800'},
});

export default SettingsScreen;
