import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { getParkings, reserveSpot, Estacionamiento } from '../services/api';
import { ParkingSpot } from '../components/ParkingSpot';
import { QRModal } from '../components/QRModal';
import { supabase } from '../services/supabase';

// ─── Hook personalizado ───────────────────────────────────

interface ReservaActiva {
  parkingId: string;
  token: string | null;
  cajon: 'A' | 'B';
  estacionamiento: string;
}

interface LoadingSpot {
  parkingId: string;
  spot: 'A' | 'B';
}

function useParkingData() {
  const [parkings, setParkings] = useState<Estacionamiento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const data = await getParkings();
      setParkings(data);
      setError(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        'No se pudo conectar al servidor. Verifica tu red.';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling automático cada 10 segundos para actualizar el estado
  useEffect(() => {
    const interval = setInterval(() => fetchData(), 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Suscripción a Supabase Realtime para actualizaciones en tiempo real
  useEffect(() => {
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey || supabaseAnonKey === 'TU_SUPABASE_ANON_KEY_AQUI') {
      console.warn('⚠️ Supabase Anon Key no configurada en mobile/.env. Las actualizaciones en tiempo real no funcionarán hasta que la agregues.');
      return;
    }

    console.log('📡 Conectando a Supabase Realtime...');
    const channel = supabase
      .channel('custom-update-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'estacionamientos',
        },
        (payload) => {
          console.log('🔔 ¡Actualización en Supabase Realtime recibida!', payload.new);
          const updatedParking = payload.new as Estacionamiento;
          
          setParkings((prevParkings) =>
            prevParkings.map((p) =>
              p.id === updatedParking.id ? { ...p, ...updatedParking } : p
            )
          );
        }
      )
      .subscribe((status) => {
        console.log(`📡 Supabase Realtime status: ${status}`);
      });

    return () => {
      console.log('🔌 Desconectando canal Supabase Realtime');
      supabase.removeChannel(channel);
    };
  }, []);

  return { parkings, isLoading, isRefreshing, error, refetch: fetchData };
}

// ─── Pantalla principal ───────────────────────────────────

export default function HomeScreen() {
  const { parkings, isLoading, isRefreshing, error, refetch } = useParkingData();

  const [reservaActiva, setReservaActiva] = useState<ReservaActiva | null>(null);
  const [loadingSpot, setLoadingSpot] = useState<LoadingSpot | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleReserve = async (parkingId: string, spot: 'A' | 'B') => {
    // Abrimos el modal primero para confirmación de reserva
    const parking = parkings.find((p) => p.id === parkingId);
    if (!parking) return;
    
    setReservaActiva({
      parkingId,
      token: null,
      cajon: spot,
      estacionamiento: parking.nombre,
    });
    setModalVisible(true);
  };

  const handleViewReservation = (token: string, spot: 'A' | 'B', parkingName: string) => {
    const parking = parkings.find((p) => p.nombre === parkingName);
    if (!parking) return;

    setReservaActiva({
      parkingId: parking.id,
      token,
      cajon: spot,
      estacionamiento: parkingName,
    });
    setModalVisible(true);
  };

  const handleReservedFromModal = (token: string) => {
    setReservaActiva((prev) => (prev ? { ...prev, token } : null));
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setReservaActiva(null);
  };

  const handleBarrierSuccess = () => {
    refetch();
  };

  // ── Render: Cargando ──
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Conectando al servidor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Error ──
  if (error && parkings.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centeredContent}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>Sin conexión</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render principal ──
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refetch(true)}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerEyebrow}>Sistema IoT</Text>
              <Text style={styles.headerTitle}>Smart Parking</Text>
            </View>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN VIVO</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            Reserva tu cajón y accede sin contacto
          </Text>
        </View>

        {/* Estadísticas rápidas */}
        <StatsBar parkings={parkings} />

        {/* Lista de estacionamientos */}
        <Text style={styles.sectionTitle}>Estacionamientos</Text>

        {parkings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏗️</Text>
            <Text style={styles.emptyText}>
              No hay estacionamientos registrados.
            </Text>
          </View>
        ) : (
          parkings.map((parking) => (
            <ParkingCard
              key={parking.id}
              parking={parking}
              loadingSpot={loadingSpot}
              onReserve={handleReserve}
              onViewReservation={handleViewReservation}
            />
          ))
        )}
      </ScrollView>

      {/* Modal QR */}
      {reservaActiva && (
        <QRModal
          visible={modalVisible}
          token={reservaActiva.token}
          cajon={reservaActiva.cajon}
          estacionamiento={reservaActiva.estacionamiento}
          parkingId={reservaActiva.parkingId}
          onClose={handleModalClose}
          onSuccess={handleBarrierSuccess}
          onReserved={handleReservedFromModal}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Sub-componente: StatsBar ─────────────────────────────

function StatsBar({ parkings }: { parkings: Estacionamiento[] }) {
  const totalSpots = parkings.length * 2;
  const occupied = parkings.reduce(
    (acc, p) =>
      acc + (p.ocupado_a ? 1 : 0) + (p.ocupado_b ? 1 : 0),
    0,
  );
  const reserved = parkings.reduce(
    (acc, p) =>
      acc + (p.reservado_a ? 1 : 0) + (p.reservado_b ? 1 : 0),
    0,
  );
  const available = totalSpots - occupied - reserved;

  return (
    <View style={styles.statsBar}>
      <StatItem value={available} label="Libres" color="#22C55E" />
      <View style={styles.statsDivider} />
      <StatItem value={reserved} label="Reservados" color="#F59E0B" />
      <View style={styles.statsDivider} />
      <StatItem value={occupied} label="Ocupados" color="#EF4444" />
    </View>
  );
}

function StatItem({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Sub-componente: ParkingCard ──────────────────────────

interface ParkingCardProps {
  parking: Estacionamiento;
  loadingSpot: LoadingSpot | null;
  onReserve: (parkingId: string, spot: 'A' | 'B') => void;
  onViewReservation: (token: string, spot: 'A' | 'B', parkingName: string) => void;
}

function ParkingCard({ parking, loadingSpot, onReserve, onViewReservation }: ParkingCardProps) {
  return (
    <View style={styles.parkingCard}>
      {/* Nombre del estacionamiento */}
      <View style={styles.parkingHeader}>
        <Text style={styles.parkingIcon}>🏢</Text>
        <View>
          <Text style={styles.parkingName}>{parking.nombre}</Text>
          {parking.ubicacion_gps && (
            <Text style={styles.parkingLocation}>📍 {parking.ubicacion_gps}</Text>
          )}
        </View>
      </View>

      {/* Cajones A y B */}
      <View style={styles.spotsRow}>
        {(['A', 'B'] as const).map((spot) => (
          <ParkingSpot
            key={spot}
            parking={parking}
            spot={spot}
            onReserve={onReserve}
            onViewReservation={onViewReservation}
            isLoading={
              loadingSpot?.parkingId === parking.id && loadingSpot?.spot === spot
            }
          />
        ))}
      </View>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },

  // Header
  header: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerEyebrow: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F1F5F9',
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  liveText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Stats
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statsDivider: {
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },

  // Parking Card
  parkingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  parkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  parkingIcon: {
    fontSize: 24,
  },
  parkingName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.3,
  },
  parkingLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  spotsRow: {
    flexDirection: 'row',
  },

  // Loading
  loadingText: {
    color: '#64748B',
    fontSize: 15,
    marginTop: 8,
  },

  // Error
  errorIcon: { fontSize: 48 },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  errorText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});
