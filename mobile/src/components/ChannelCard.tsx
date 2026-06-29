import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Channel} from '../types';
import {colors, radii} from '../theme';

interface ChannelCardProps {
  channel: Channel;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
  width?: number;
}

const screenWidth = Dimensions.get('window').width;
const defaultWidth = (screenWidth - 44) / 2;

const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isFavorite,
  onPress,
  onToggleFavorite,
  width = defaultWidth,
}) => {
  const [imageError, setImageError] = useState(false);
  const logoUrl = channel.logo || channel.tvgLogo;

  return (
    <TouchableOpacity
      style={[styles.card, {width}]}
      onPress={onPress}
      activeOpacity={0.82}>
      <View style={[styles.artwork, {height: width}]}>
        {logoUrl && !imageError ? (
          <Image
            source={{uri: logoUrl}}
            style={styles.logo}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <Icon name="television-classic" size={42} color={colors.textDim} />
        )}

        {channel.isHD && (
          <View style={styles.hdBadge}>
            <Text style={styles.badgeText}>HD</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={event => {
            event.stopPropagation();
            onToggleFavorite?.();
          }}>
          <Icon
            name={isFavorite ? 'star' : 'star-outline'}
            size={21}
            color={isFavorite ? colors.primary : colors.text}
          />
        </TouchableOpacity>

        <View style={styles.playButton}>
          <Icon name="play" size={24} color={colors.background} />
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{channel.name}</Text>
        {!!channel.group && (
          <Text style={styles.group} numberOfLines={1}>{channel.group}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 6,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.small,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  artwork: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  hdBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: colors.primary,
  },
  badgeText: {
    color: colors.background,
    fontSize: 9,
    fontWeight: '900',
  },
  favoriteButton: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.92,
  },
  info: {
    minHeight: 64,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  name: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  group: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
});

export default React.memo(ChannelCard);
