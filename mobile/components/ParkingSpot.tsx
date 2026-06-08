import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Estacionamiento } from '../services/api';

interface ParkingSpotProps {
  parking: Estacionamiento;
  spot: 'A' | 'B';
  onReserve: (parkingId: string, spot: 'A' | 'B') => void;
  onViewReservation: (token: string, spot: 'A' | 'B', parkingName: string) => void;
  isLoading?: boolean;
}

const serif = Platform.select({ web: '"Playfair Display", Georgia, serif', default: undefined });
const sans  = Platform.select({ web: '"Inter", system-ui, sans-serif',      default: undefined });

function getState(p: Estacionamiento, spot: 'A' | 'B') {
  return {
    ocupado:  spot === 'A' ? p.ocupado_a  : p.ocupado_b,
    reservado: spot === 'A' ? p.reservado_a : p.reservado_b,
  };
}

export const ParkingSpot: React.FC<ParkingSpotProps> = ({
  parking, spot, onReserve, onViewReservation, isLoading = false,
}) => {
  const { ocupado, reservado } = getState(parking, spot);
  const isAvailable = !ocupado && !reservado;
  const token = spot === 'A' ? parking.token_reserva_a : parking.token_reserva_b;

  const handlePress = () => {
    if (isAvailable) onReserve(parking.id, spot);
    else if (reservado && token) onViewReservation(token, spot, parking.nombre);
  };

  const canPress = isAvailable || (reservado && !!token);

  const theme = ocupado
    ? themes.occupied
    : reservado
    ? themes.reserved
    : themes.available;

  const statusLabel = ocupado ? 'Ocupado' : reservado ? 'Reservado' : 'Disponible';
  const spotIcon    = ocupado ? '🚗' : reservado ? '🔒' : '🅿️';
  const btnLabel    = isAvailable ? 'Reservar' : reservado ? 'Ver QR' : statusLabel;

  return (
    <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      {/* Header row */}
      <View style={s.header}>
        <View style={s.labelRow}>
          <View style={[s.dot, { backgroundColor: theme.indicator }]} />
          <Text style={s.spotLabel}>Cajón {spot}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder }]}>
          <Text style={[s.badgeText, { color: theme.indicator }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Icon */}
      <Text style={s.icon}>{spotIcon}</Text>

      {/* Button */}
      <TouchableOpacity
        style={[
          s.btn,
          { backgroundColor: theme.btnBg, borderColor: theme.btnBorder },
          !canPress && s.btnDisabled,
        ]}
        onPress={handlePress}
        disabled={!canPress || isLoading}
        activeOpacity={0.8}
      >
        {isLoading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={[s.btnText, !canPress && s.btnTextDisabled]}>{btnLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
};

const themes = {
  available: {
    cardBg:      'rgba(27, 90, 55, 0.12)',
    border:      'rgba(39, 174, 96, 0.28)',
    indicator:   '#27AE60',
    badgeBg:     'rgba(39, 174, 96, 0.12)',
    badgeBorder: 'rgba(39, 174, 96, 0.25)',
    btnBg:       '#1A6B40',
    btnBorder:   'rgba(39, 174, 96, 0.4)',
  },
  reserved: {
    cardBg:      'rgba(180, 130, 0, 0.10)',
    border:      'rgba(201, 168, 76, 0.3)',
    indicator:   '#C9A84C',
    badgeBg:     'rgba(201, 168, 76, 0.12)',
    badgeBorder: 'rgba(201, 168, 76, 0.28)',
    btnBg:       '#8A6210',
    btnBorder:   'rgba(201, 168, 76, 0.4)',
  },
  occupied: {
    cardBg:      'rgba(92, 16, 32, 0.15)',
    border:      'rgba(200, 40, 60, 0.25)',
    indicator:   '#E53E50',
    badgeBg:     'rgba(200, 40, 60, 0.10)',
    badgeBorder: 'rgba(200, 40, 60, 0.22)',
    btnBg:       'rgba(100, 116, 139, 0.25)',
    btnBorder:   'rgba(100, 116, 139, 0.2)',
  },
};

const s = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  spotLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C8D8E8',
    fontFamily: serif,
    letterSpacing: 0.4,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: sans,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  icon: {
    fontSize: 34,
    marginVertical: 10,
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: '#EDE6D3',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: sans,
    letterSpacing: 0.4,
  },
  btnTextDisabled: {
    color: '#7A8FA6',
  },
});
