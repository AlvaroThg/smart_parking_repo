import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { getParkings, Estacionamiento } from '../services/api';
import { ParkingSpot } from '../components/ParkingSpot';
import { QRModal } from '../components/QRModal';
import { supabase } from '../services/supabase';

// ─── Fuentes ─────────────────────────────────────────────────────────────────

const serif = Platform.select({ web: '"Playfair Display", Georgia, serif', default: undefined });
const sans  = Platform.select({ web: '"Inter", system-ui, sans-serif',      default: undefined });

// ─── Paleta ───────────────────────────────────────────────────────────────────

const C = {
  bg:          '#08121E',
  card:        '#0F1E30',
  elevated:    '#162840',
  gold:        '#C9A84C',
  goldGlow:    'rgba(201,168,76,0.10)',
  goldBorder:  'rgba(201,168,76,0.18)',
  cream:       '#EDE6D3',
  muted:       '#6E8299',
  mutedFaint:  'rgba(110,130,153,0.14)',
  green:       '#27AE60',
  amber:       '#C9A84C',
  crimson:     '#E53E50',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Hook de datos ────────────────────────────────────────────────────────────

function useParkingData() {
  const [parkings,     setParkings]     = useState<Estacionamiento[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const data = await getParkings();
      setParkings(data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'No se pudo conectar al servidor. Verifica tu red.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => fetchData(), 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!key || key === 'TU_SUPABASE_ANON_KEY_AQUI') return;

    const channel = supabase
      .channel('estacionamientos-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'estacionamientos' },
        (payload) => {
          const updated = payload.new as Estacionamiento;
          setParkings((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { parkings, isLoading, isRefreshing, error, refetch: fetchData };
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function HomeScreen() {
  const { parkings, isLoading, isRefreshing, error, refetch } = useParkingData();
  const [reservaActiva, setReservaActiva] = useState<ReservaActiva | null>(null);
  const [loadingSpot] = useState<LoadingSpot | null>(null);
  const [modalVisible,  setModalVisible]  = useState(false);

  const handleReserve = (parkingId: string, spot: 'A' | 'B') => {
    const parking = parkings.find((p) => p.id === parkingId);
    if (!parking) return;
    setReservaActiva({ parkingId, token: null, cajon: spot, estacionamiento: parking.nombre });
    setModalVisible(true);
  };

  const handleViewReservation = (token: string, spot: 'A' | 'B', parkingName: string) => {
    const parking = parkings.find((p) => p.nombre === parkingName);
    if (!parking) return;
    setReservaActiva({ parkingId: parking.id, token, cajon: spot, estacionamiento: parkingName });
    setModalVisible(true);
  };

  const handleReservedFromModal = (token: string) => {
    setReservaActiva((prev) => prev ? { ...prev, token } : null);
  };

  const handleModalClose = () => { setModalVisible(false); setReservaActiva(null); };

  // ── Cargando ──
  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar style="light" />
        <View style={s.centered}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={s.loadingText}>Conectando al servidor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error && parkings.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar style="light" />
        <View style={s.centered}>
          <Text style={s.errorIcon}>📡</Text>
          <Text style={s.errorTitle}>Sin conexión</Text>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Principal ──
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refetch(true)}
            tintColor={C.gold}
            colors={[C.gold]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.eyebrow}>Sistema IoT</Text>
              <Text style={s.headerTitle}>Smart Parking</Text>
            </View>
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>En Vivo</Text>
            </View>
          </View>
          <Text style={s.subtitle}>Reserva tu cajón y accede sin contacto</Text>
          <View style={s.headerDivider} />
        </View>

        {/* ── Stats ── */}
        <StatsBar parkings={parkings} />

        {/* ── Lista ── */}
        <Text style={s.sectionLabel}>Estacionamientos</Text>

        {parkings.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🏗️</Text>
            <Text style={s.emptyText}>No hay estacionamientos registrados.</Text>
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

      {reservaActiva && (
        <QRModal
          visible={modalVisible}
          token={reservaActiva.token}
          cajon={reservaActiva.cajon}
          estacionamiento={reservaActiva.estacionamiento}
          parkingId={reservaActiva.parkingId}
          onClose={handleModalClose}
          onSuccess={() => refetch()}
          onReserved={handleReservedFromModal}
        />
      )}
    </SafeAreaView>
  );
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ parkings }: { parkings: Estacionamiento[] }) {
  const total    = parkings.length * 2;
  const occupied = parkings.reduce((n, p) => n + (p.ocupado_a ? 1 : 0) + (p.ocupado_b ? 1 : 0), 0);
  const reserved = parkings.reduce((n, p) => n + (p.reservado_a ? 1 : 0) + (p.reservado_b ? 1 : 0), 0);
  const free     = total - occupied - reserved;

  return (
    <View style={s.statsCard}>
      <StatItem value={free}     label="Libres"     color={C.green}   />
      <View style={s.statSep} />
      <StatItem value={reserved} label="Reservados" color={C.amber}   />
      <View style={s.statSep} />
      <StatItem value={occupied} label="Ocupados"   color={C.crimson} />
    </View>
  );
}

function StatItem({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={s.statItem}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─── ParkingCard ──────────────────────────────────────────────────────────────

interface ParkingCardProps {
  parking: Estacionamiento;
  loadingSpot: LoadingSpot | null;
  onReserve: (id: string, spot: 'A' | 'B') => void;
  onViewReservation: (token: string, spot: 'A' | 'B', name: string) => void;
}

function ParkingCard({ parking, loadingSpot, onReserve, onViewReservation }: ParkingCardProps) {
  return (
    <View style={s.parkingCard}>
      <View style={s.parkingHeader}>
        <View style={s.parkingIconBg}>
          <Text style={s.parkingIconEmoji}>🏢</Text>
        </View>
        <View style={s.parkingInfo}>
          <Text style={s.parkingName}>{parking.nombre}</Text>
          {parking.ubicacion_gps ? (
            <Text style={s.parkingLocation}>📍 {parking.ubicacion_gps}</Text>
          ) : null}
        </View>
      </View>
      <View style={s.spotsRow}>
        {(['A', 'B'] as const).map((spot) => (
          <ParkingSpot
            key={spot}
            parking={parking}
            spot={spot}
            onReserve={onReserve}
            onViewReservation={onViewReservation}
            isLoading={loadingSpot?.parkingId === parking.id && loadingSpot?.spot === spot}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  scroll:    { paddingHorizontal: 20, paddingBottom: 48 },

  // Header
  header:     { paddingTop: 28, paddingBottom: 6 },
  headerTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  eyebrow: {
    fontSize: 11,
    color: C.gold,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 3,
    fontFamily: sans,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: C.cream,
    fontFamily: serif,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 20,
    fontFamily: sans,
  },
  headerDivider: {
    height: 1,
    backgroundColor: C.goldBorder,
    marginBottom: 20,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(39,174,96,0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(39,174,96,0.22)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  liveText: {
    color: C.green,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: sans,
    letterSpacing: 0.8,
  },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  statItem:  { flex: 1, alignItems: 'center', gap: 3 },
  statSep:   { width: 1, backgroundColor: C.mutedFaint },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: serif,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '600',
    fontFamily: sans,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Section
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
    fontFamily: sans,
  },

  // Parking card
  parkingCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.goldBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  parkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  parkingIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.goldGlow,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingIconEmoji: { fontSize: 20 },
  parkingInfo: { flex: 1 },
  parkingName: {
    fontSize: 17,
    fontWeight: '700',
    color: C.cream,
    fontFamily: serif,
    letterSpacing: 0.2,
  },
  parkingLocation: {
    fontSize: 11,
    color: C.muted,
    marginTop: 1,
    fontFamily: sans,
  },
  spotsRow: { flexDirection: 'row' },

  // Loading / error
  loadingText: { color: C.muted, fontSize: 14, fontFamily: sans },
  errorIcon:   { fontSize: 48 },
  errorTitle:  { fontSize: 22, fontWeight: '800', color: C.cream, fontFamily: serif },
  errorText:   { color: C.muted, fontSize: 13, textAlign: 'center', fontFamily: sans, lineHeight: 20 },
  retryBtn: {
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 4,
  },
  retryText: { color: '#08121E', fontWeight: '700', fontSize: 14, fontFamily: sans },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon:  { fontSize: 40 },
  emptyText:  { color: C.muted, fontSize: 13, fontFamily: sans },
});
