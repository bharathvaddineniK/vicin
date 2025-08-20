import { Post } from '@/hooks/usePosts';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import {
  ChatCircle,
  DotsThree,
  Heart,
  Share,
} from 'phosphor-react-native';
import React, { memo, useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  Share as RNShare,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface PostCardProps {
  post: Post;
  userLocation?: { lat: number; lng: number };
  onLike?: (postId: string, isLiked: boolean) => void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Extract coordinates from PostGIS geography
const extractCoordinates = (geography: any): { lat: number; lng: number } | null => {
  try {
    if (geography) {
      // If it's already parsed coordinates
      if (geography.coordinates && Array.isArray(geography.coordinates)) {
        return {
          lng: geography.coordinates[0],
          lat: geography.coordinates[1]
        };
      }
      // If it's a string representation, try to parse it
      if (typeof geography === 'string') {
        // Handle POINT(lng lat) format
        const pointMatch = geography.match(/POINT\(([^)]+)\)/);
        if (pointMatch) {
          const coords = pointMatch[1].split(' ');
          return {
            lng: parseFloat(coords[0]),
            lat: parseFloat(coords[1])
          };
        }
      }
      // If it has lat/lng properties directly
      if (geography.lat && geography.lng) {
        return {
          lng: geography.lng,
          lat: geography.lat
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    return null;
  }
};

// Format distance for display
const formatDistance = (distance: number): string => {
  if (distance < 0.1) return '< 0.1 mi';
  if (distance < 1) return `${distance.toFixed(1)} mi`;
  return `${Math.round(distance)} mi`;
};

// Format expiration time consistently
const formatExpiresIn = (expiresAt: string): string => {
  const now = new Date();
  const expireDate = new Date(expiresAt);
  const diffInMs = expireDate.getTime() - now.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMs <= 0) return 'Expired';
  if (diffInHours < 1) return 'Expires in < 1h';
  if (diffInHours < 24) return `Expires in ${diffInHours}h`;
  if (diffInDays < 7) return `Expires in ${diffInDays}d`;
  return `Expires ${expireDate.toLocaleDateString()}`;
};

const PostCard = memo<PostCardProps>(({ 
  post, 
  userLocation, 
  onLike, 
  onComment, 
  onShare 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isLiked, setIsLiked] = useState(false); // TODO: Get from user's likes
  const [likeCount, setLikeCount] = useState(post.post_likes?.length || 0);

  // Calculate distance based on location_source - simple logic
  const getDistanceText = (): string => {
    if (!userLocation) {
      return '-- mi';
    }
    
    let targetCoords: { lat: number; lng: number } | null = null;
    
    // Simple logic: use venue_location if available, otherwise use post.location
    if (post.location_source === 'venue' && post.venue_location) {
      targetCoords = extractCoordinates(post.venue_location);
    } else if (post.location) {
      targetCoords = extractCoordinates(post.location);
    }
    
    if (!targetCoords) {
      return '-- mi';
    }
    
    // Calculate distance between current user and target location
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      targetCoords.lat,
      targetCoords.lng
    );
    
    return formatDistance(distance);
  };

  // Sort media: images first, videos last
  const sortedMedia = post.post_media ? [...post.post_media].sort((a, b) => {
    if (a.kind === 'image' && b.kind === 'video') return -1;
    if (a.kind === 'video' && b.kind === 'image') return 1;
    return 0;
  }) : [];

  const renderMediaItem = ({ item, index }: { item: any; index: number }) => {
    if (item.kind === 'image') {
      return (
        <Image
          source={{ uri: item.url }}
          style={styles.mediaItem}
          resizeMode="cover"
        />
      );
    } else if (item.kind === 'video') {
      return (
        <View style={styles.mediaItem}>
          <Image
            source={{ uri: item.url }}
            style={styles.mediaItem}
            resizeMode="cover"
          />
          <View style={styles.videoOverlay}>
            <Text style={styles.videoIcon}>▶️</Text>
          </View>
        </View>
      );
    }
    return null;
  };

  const handleLike = useCallback(async () => {
    try {
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);
      setLikeCount(prev => newIsLiked ? prev + 1 : prev - 1);
      
      if (newIsLiked) {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: 'current-user-id' });
      } else {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', 'current-user-id');
      }
      
      onLike?.(post.id, newIsLiked);
    } catch (error) {
      setIsLiked(!isLiked);
      setLikeCount(prev => isLiked ? prev + 1 : prev - 1);
      console.error('Error liking post:', error);
    }
  }, [isLiked, post.id, onLike]);

  const handleComment = useCallback(() => {
    onComment?.(post.id);
    router.push(`/post/${post.id}/comments`);
  }, [post.id, onComment]);

  const handleShare = useCallback(async () => {
    try {
      const shareContent = {
        message: `Check out this post: ${post.content}`,
        url: `https://yourapp.com/post/${post.id}`,
        title: 'Vicin Post'
      };
      
      await RNShare.share(shareContent);
      onShare?.(post.id);
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  }, [post.id, post.content, onShare]);

  const handleReport = useCallback(() => {
    setShowMenu(false);
    Alert.alert(
      'Report Post',
      'Why are you reporting this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Inappropriate', onPress: () => submitReport('inappropriate') },
        { text: 'Harassment', onPress: () => submitReport('harassment') },
      ]
    );
  }, []);

  const submitReport = async (reason: string) => {
    try {
      await supabase
        .from('reports')
        .insert({
          target_type: 'post',
          target_id: post.id,
          reporter_id: 'current-user-id',
          reason,
          severity: 2,
        });
      Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const username = post.author?.handle || 'anonymous';
  const expiresIn = post.expires_at ? formatExpiresIn(post.expires_at) : null;
  const commentCount = post.post_comments?.length || 0;
  const distanceText = getDistanceText();

  return (
    <View style={styles.container}>
      {/* Header row - avatar, username, metadata, menu icon */}
      <View style={styles.header}>
        <Image
          source={{ 
            uri: post.author?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=E5E7EB&color=6B7280&size=40`
          }}
          style={styles.avatar}
          accessibilityLabel={`${username}'s avatar`}
        />
        <View style={styles.headerContent}>
          <Text style={styles.username} numberOfLines={1}>
            {username}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.distance}>{distanceText}</Text>
            {expiresIn && (
              <>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.expiresIn}>{expiresIn}</Text>
              </>
            )}
          </View>
        </View>
        <Pressable
          onPress={() => setShowMenu(true)}
          style={styles.menuButton}
          accessibilityLabel="Post options"
          accessibilityRole="button"
        >
          <DotsThree size={18} color="#9CA3AF" weight="bold" />
        </Pressable>
      </View>

      {/* Content text */}
      <Pressable
        onPress={() => router.push(`/post/${post.id}`)}
        accessibilityLabel={`Open post: ${post.content || 'No content'}`}
        accessibilityRole="button"
      >
        <Text style={styles.content}>{post.content || ''}</Text>
        
        {/* Image block - full width within card */}
        {sortedMedia.length > 0 && (
          <View style={styles.mediaContainer}>
            <FlatList
              data={sortedMedia}
              renderItem={renderMediaItem}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={screenWidth - 48} // Account for card padding
              decelerationRate="fast"
              style={styles.mediaSlider}
            />
            {sortedMedia.length > 1 && (
              <View style={styles.mediaIndicator}>
                <Text style={styles.mediaCount}>
                  1 / {sortedMedia.length}
                </Text>
              </View>
            )}
          </View>
        )}
      </Pressable>

      {/* Hashtags - smaller, lighter text */}
      {post.tags && post.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {post.tags.map((tag, index) => (
            <Text key={index} style={styles.tag}>
              #{tag}
            </Text>
          ))}
        </View>
      )}

      {/* Action bar - evenly spaced icons */}
      <View style={styles.actions}>
        <Pressable
          onPress={handleLike}
          style={styles.actionButton}
          accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'} post`}
          accessibilityRole="button"
        >
          <Heart
            size={18}
            color={isLiked ? '#EF4444' : '#6B7280'}
            weight={isLiked ? 'fill' : 'regular'}
          />
          {likeCount > 0 && (
            <Text style={[styles.actionCount, isLiked && styles.likedCount]}>
              {likeCount}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleComment}
          style={styles.actionButton}
          accessibilityLabel="Comment on post"
          accessibilityRole="button"
        >
          <ChatCircle size={18} color="#6B7280" weight="regular" />
          {commentCount > 0 && (
            <Text style={styles.actionCount}>{commentCount}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleShare}
          style={styles.actionButton}
          accessibilityLabel="Share post"
          accessibilityRole="button"
        >
          <Share size={18} color="#6B7280" weight="regular" />
        </Pressable>
      </View>

      {/* Options Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleReport}
              accessibilityLabel="Report post"
              accessibilityRole="button"
            >
              <Text style={styles.menuItemText}>Report</Text>
            </TouchableOpacity>
            <View style={styles.menuSeparator} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                Alert.alert('Help', 'Contact support or block user options would go here.');
              }}
              accessibilityLabel="Get help"
              accessibilityRole="button"
            >
              <Text style={styles.menuItemText}>Help</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  // Card container - 16px padding, 12px radius, subtle shadow, no left/right margin
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 0.5,
    borderColor: '#F3F4F6',
  },
  
  // Header row - tight alignment
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerContent: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distance: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  separator: {
    fontSize: 13,
    color: '#6B7280',
    marginHorizontal: 3,
  },
  expiresIn: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  menuButton: {
    padding: 2,
    marginTop: -2,
  },
  
  // Content text - increased line spacing, margin-bottom 8px
  content: {
    fontSize: 15,
    lineHeight: 21,
    color: '#111827',
    marginBottom: 8,
  },
  
  // Image block - full width within card, same border radius
  mediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  mediaSlider: {
    height: 240,
  },
  mediaItem: {
    width: screenWidth - 48, // Full width minus card padding
    height: 240,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  mediaIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mediaCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  
  // Hashtags - smaller, lighter, no huge space
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 3,
  },
  tag: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '400',
  },
  
  // Action bar - evenly spaced, reduced gap
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 24,
  },
  actionCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
    minWidth: 10,
  },
  likedCount: {
    color: '#EF4444',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    padding: 12,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '400',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
});

PostCard.displayName = 'PostCard';

export default PostCard;
