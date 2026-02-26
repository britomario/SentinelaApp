import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MapView, {Marker} from 'react-native-maps';

import {getCurrentChildId} from '../../services/currentChildService';
import {subscribeToChildLocation} from '../../services/realtime/socketService';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

export default function MapScreen(): React.JSX.Element {
  const [childId, setChildId] = useState('local-child');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);

  useEffect(() => {
    getCurrentChildId()
      .then(id => setChildId(id))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return subscribeToChildLocation(childId, payload => {
      setLocation({
        latitude: payload.latitude,
        longitude: payload.longitude,
        timestamp: payload.timestamp,
      });
    });
  }, [childId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mapa & Localização</Text>
      <View style={styles.card}>
        {location ? (
          <>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}>
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title="Dispositivo monitorado"
                description="Localização atual"
              />
            </MapView>
            <Text style={styles.updatedAt}>
              Atualizado às {new Date(location.timestamp).toLocaleTimeString('pt-BR')}
            </Text>
          </>
        ) : (
          <Text style={styles.empty}>Aguardando localização do dispositivo pareado.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadows.soft,
  },
  map: {
    flex: 1,
    borderRadius: BorderRadius.lg,
  },
  updatedAt: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  empty: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
});
