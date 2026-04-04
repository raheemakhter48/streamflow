import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../context/AuthContext';
import {useNavigation} from '@react-navigation/native';

const {height, width} = Dimensions.get('window');

const AuthScreen: React.FC = () => {
  const navigation = useNavigation();
  const {login, register} = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Figma Colors
  const primaryCyan = '#00D7E5';
  const secondaryCyan = '#00A8B5';
  const blackBg = '#000000';

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      setError('Invalid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Background Glows */}
      <View style={styles.glowContainer}>
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          
          <View style={styles.topSection}>
            <Image 
              source={require('../assets/logo.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
            <Text style={styles.title}>STREAM VAULT</Text>
            <Text style={styles.tagline}>
              {isLogin ? 'STREAM YOUR IPTV LIKE NEVER BEFORE' : 'JOIN THE ULTIMATE STREAMING EXPERIENCE'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </Text>

            {error ? (
              <View style={styles.errorBadge}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#444"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>SECRET KEY</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#444"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
              style={styles.submitBtn}>
              <LinearGradient
                colors={[primaryCyan, secondaryCyan]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.btnGradient}>
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {isLogin ? 'ENTER VAULT' : 'GET STARTED'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => {
                setIsLogin(!isLogin);
                setError('');
              }}>
              <Text style={styles.toggleText}>
                {isLogin
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <Text style={{color: primaryCyan, fontWeight: '900'}}>
                  {isLogin ? 'SIGN UP' : 'LOGIN'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>
              POWERED BY STREAMFLOW TECHNOLOGY
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
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
  bottomGlow: {
    position: 'absolute',
    bottom: -150,
    right: -150,
    width: width,
    height: width,
    backgroundColor: 'rgba(0, 168, 181, 0.05)',
    borderRadius: width * 0.5,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: height * 0.08,
    paddingBottom: 40,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 20,
    shadowColor: '#00D7E5',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  logoIcon: {
    fontSize: 36,
    color: '#000',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
    fontStyle: 'italic',
  },
  tagline: {
    fontSize: 12,
    color: '#00D7E5',
    marginTop: 8,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 35,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 30,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#00D7E5',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
    marginLeft: 5,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    height: 60,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  submitBtn: {
    marginTop: 10,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#00D7E5',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  btnGradient: {
    height: 65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  toggleButton: {
    marginTop: 25,
    alignItems: 'center',
  },
  toggleText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 40,
  },
  footerLine: {
    width: 100,
    height: 1,
    backgroundColor: 'rgba(0, 215, 229, 0.2)',
    marginBottom: 15,
  },
  footerText: {
    color: '#333',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
});

export default AuthScreen;
