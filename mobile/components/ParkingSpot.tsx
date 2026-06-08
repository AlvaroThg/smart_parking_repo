import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Estacionamiento } from '../services/api';

// ─── Tipos ───────────────────────────────────────────────

interface SpotState {
  ocupado: boolean;
  reservado: boolean;
}

interface ParkingSpotProps {
  parking: Estacionamiento;
  spot: 'A' | 'B';
  onReserve: (parkingId: string, spot: 'A' | 'B') => void;
  onViewReservation: (token: string, spot: 'A' | 'B', parkingName: string) => void;
  isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────

function getSpotState(parking: Estacionamiento, spot: 'A' | 'B'): SpotState {
  return {
    ocupado: spot === 'A' ? parking.ocupado_a : parking.ocupado_b,
    reservado: spot === 'A' ? parking.reservado_a : parking.reservado_b,
  };
}

function getStatusLabel(state: SpotState): string {
  if (state.ocupado) return 'Ocupado';
  if (state.reservado) return 'Reservado';
  return 'Disponible';
}

// ─── Componente ───────────────────────────────────────────

export const ParkingSpot: React.FC<ParkingSpotProps> = ({
  parking,
  spot,
  onReserve,
  onViewReservation,
  isLoading = false,
}) => {
  const state = getSpotState(parking, spot);
  const isAvailable = !state.ocupado && !state.reservado;
  const isReserved = state.reservado;
  const statusLabel = getStatusLabel(state);

  const token = spot === 'A' ? parking.token_reserva_a : parking.token_reserva_b;

  const handlePress = () => {
    if (isAvailable) {
      onReserve(parking.id, spot);
    } else if (isReserved && token) {
      onViewReservation(token, spot, parking.nombre);
    }
  };

  const buttonEnabled = isAvailable || (isReserved && !!token);

  const containerColor = isAvailable
    ? styles.available
    : state.reservado
    ? styles.reserved
    : styles.occupied;

  const statusDotColor = isAvailable
    ? '#22C55E'
    : state.reservado
    ? '#F59E0B'
    : '#EF4444';

  return (
    <View style={[styles.spotCard, containerColor]}>
      {/* Encabezado del cajón */}
      <View style={styles.spotHeader}>
        <View style={styles.spotLabelRow}>
          <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
          <Text style={styles.spotLabel}>Cajón {spot}</Text>
        </View>
        <Text style={[styles.statusBadge, { color: statusDotColor }]}>
          {statusLabel}
        </Text>
      </View>

      {/* Icono del vehículo */}
      <Text style={styles.carIcon}>{isAvailable ? '🅿️' : state.reservado ? '🔒' : '🚗'}</Text>

      {/* Botón de reserva */}
      <TouchableOpacity
        style={[
          styles.reserveButton,
          !buttonEnabled && styles.reserveButtonDisabled,
          isReserved && styles.viewReserveButton,
        ]}
        onPress={handlePress}
        disabled={!buttonEnabled || isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.reserveButtonText}>
            {isAvailable ? 'Reservar' : isReserved ? 'Ver QR' : statusLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ─── Estilos ─────────────────────────────────────────────

const styles = StyleSheet.create({
  spotCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
  },
  available: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  reserved: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  occupied: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  spotHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  spotLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  spotLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: 0.5,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  carIcon: {
    fontSize: 36,
    marginVertical: 12,
  },
  reserveButton: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  reserveButtonDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.4)',
    shadowOpacity: 0,
    elevation: 0,
  },
  viewReserveButton: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
  },
  reserveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
