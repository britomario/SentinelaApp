/**
 * Onboarding Tour - Carrossel imersivo estilo Digital Health
 * 4 etapas com copywriting e gatilhos mentais
 */

import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {
  HeartPulse,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {markCarouselCompleted} from '../services/onboardingState';
import {Colors, Spacing, BorderRadius} from '../theme/colors';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

type RootStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  PinSetup: undefined;
  Main: undefined;
};

type Slide = {
  id: string;
  icon: React.ElementType;
  title: string;
  body: string;
  colors: [string, string];
  badge?: string;
  badges?: string[];
};

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: HeartPulse,
    title: 'O Perigo',
    body: 'Você sabia? O uso desenfreado de telas pode afetar o desenvolvimento cognitivo e o sono do seu filho.',
    colors: ['#0B1C3F', '#153E75'],
    badge: 'Baseado em diretrizes da OMS e Academia de Pediatria',
  },
  {
    id: '2',
    icon: Trophy,
    title: 'A Solução',
    body: 'Transforme tempo de tela em conquistas. Com a nossa gamificação, ele aprende a ganhar cada minuto de diversão através de tarefas reais.',
    colors: ['#0F172A', '#1E3A5F'],
  },
  {
    id: '3',
    icon: ShieldCheck,
    title: 'Segurança',
    body: 'Filtro de conteúdo e DNS ativo. Proteja sua família contra sites maliciosos e anúncios invasivos automaticamente.',
    colors: ['#0E1C2E', '#134E4A'],
    badges: ['Segurança Verificada', 'Recomendado por Especialistas em Saúde Digital'],
  },
  {
    id: '4',
    icon: Users,
    title: 'Vamos começar?',
    body: 'Você no controle, eles no aprendizado. Vamos começar?',
    colors: ['#10233F', '#1E3A8A'],
  },
];

export default function OnboardingCarousel(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Onboarding'>>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const goToWelcome = async () => {
    await markCarouselCompleted();
    navigation.replace('Welcome');
  };

  const renderSlide = ({item}: {item: Slide}) => {
    const Icon = item.icon;
    return (
      <View style={styles.slide}>
      <LinearGradient
        colors={item.colors}
        style={styles.gradient}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={styles.iconWrap}>
          <Icon size={42} color={Colors.white} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        {item.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        {item.badges && (
          <View style={styles.badgesRow}>
            {item.badges.map(b => (
              <View key={b} style={styles.badge}>
                <Text style={styles.badgeText}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
    );
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <TouchableOpacity style={styles.skipBtn} onPress={goToWelcome}>
        <Text style={styles.skipText}>Pular</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      <View style={[styles.footer, {paddingBottom: Math.max(24, insets.bottom + 16)}]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, idx) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                idx === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => {
            if (isLastSlide) {
              goToWelcome();
            } else {
              flatListRef.current?.scrollToIndex({index: currentIndex + 1, animated: true});
            }
          }}
          activeOpacity={0.8}>
          <Text style={styles.ctaText}>
            {isLastSlide ? 'Criar Conta / Login Social' : 'Próximo'}
          </Text>
        </TouchableOpacity>

        {!isLastSlide && (
          <Text style={styles.nextHint}>Deslize para continuar</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  skipBtn: {
    position: 'absolute',
    top: 58,
    right: Spacing.lg,
    zIndex: 10,
  },
  skipText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: 112,
    alignItems: 'center',
  },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  body: {
    fontSize: 18,
    lineHeight: 26,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  badge: {
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  badgeText: {
    color: Colors.childMint,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgesRow: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: BorderRadius.xl,
    width: '100%',
    alignItems: 'center',
  },
  ctaText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  nextHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: Spacing.sm,
  },
});
