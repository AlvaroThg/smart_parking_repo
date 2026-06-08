import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { openBarrier, cancelReservation, reserveSpot } from '../services/api';

// ─── Tipos ───────────────────────────────────────────────

interface QRModalProps {
  visible: boolean;
  token: string | null; // null si no está reservado aún
  cajon: 'A' | 'B';
  estacionamiento: string;
  parkingId: string;
  onClose: () => void;
  onSuccess: () => void; // Callback para refrescar el estado del parking
  onReserved: (token: string) => void; // Callback para registrar el token en el estado principal
}

// ─── Componente ───────────────────────────────────────────

export const QRModal: React.FC<QRModalProps> = ({
  visible,
  token,
  cajon,
  estacionamiento,
  parkingId,
  onClose,
  onSuccess,
  onReserved,
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [barrierOpened, setBarrierOpened] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isReserving, setIsReserving] = useState(false);

  const handleOpenBarrier = async () => {
    if (!token) return;
    setIsOpening(true);
    try {
      const response = await openBarrier(token);
      setBarrierOpened(true);
      Alert.alert(
        '🚗 ¡Bienvenido!',
        response.mensaje,
        [
          {
            text: 'Entendido',
            onPress: () => {
              setBarrierOpened(false);
              onSuccess();
              onClose();
            },
          },
        ],
      );
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ??
        'No se pudo abrir la barrera. Intenta nuevamente.';
      Alert.alert('❌ Error', msg);
    } finally {
      setIsOpening(false);
    }
  };

  const handleReserve = async () => {
    setIsReserving(true);
    try {
      const response = await reserveSpot(parkingId, cajon);
      Alert.alert('✅ ¡Reservado!', response.mensaje);
      onReserved(response.token);
      onSuccess();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ??
        'No se pudo completar la reserva. Intenta de nuevo.';
      Alert.alert('⚠️ Error', msg);
    } finally {
      setIsReserving(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!token) return;
    Alert.alert(
      '⚠️ Cancelar Reserva',
      '¿Estás seguro de que deseas cancelar tu reserva? El cajón volverá a estar disponible para otros usuarios.',
      [
        {
          text: 'No, mantener',
          style: 'cancel',
        },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setIsCanceling(true);
            try {
              const response = await cancelReservation(token);
              Alert.alert(
                '❌ Cancelada',
                response.mensaje,
                [
                  {
                    text: 'Aceptar',
                    onPress: () => {
                      onSuccess();
                      onClose();
                    },
                  },
                ],
              );
            } catch (error: any) {
              const msg =
                error?.response?.data?.message ??
                'No se pudo cancelar la reserva. Intenta de nuevo.';
              Alert.alert('⚠️ Error', msg);
            } finally {
              setIsCanceling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Barra decorativa superior */}
          <View style={styles.dragHandle} />

          {/* Encabezado */}
          <View style={styles.header}>
            <Text style={styles.title}>{token ? 'Tu Reserva' : 'Reservar Cajón'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Info de la reserva */}
          <View style={styles.infoRow}>
            <InfoChip icon="🏢" label={estacionamiento} />
            <InfoChip icon="🅿️" label={`Cajón ${cajon}`} />
          </View>

          {/* QR Code o Placeholder */}
          <View style={styles.qrContainer}>
            {token ? (
              <>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={token}
                    size={200}
                    color="#0F172A"
                    backgroundColor="#FFFFFF"
                    quietZone={12}
                  />
                </View>
                <Text style={styles.qrLabel}>Paga a este QR 5bs</Text>
                <Text style={styles.tokenText} numberOfLines={1} ellipsizeMode="middle">
                  {token}
                </Text>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderIcon}>🔑</Text>
                <Text style={styles.placeholderText}>Confirma tu reserva para generar el código QR de acceso</Text>
              </View>
            )}
          </View>

          {/* Divisor */}
          <View style={styles.divider} />

          {/* Botón principal */}
          {token ? (
            <TouchableOpacity
              style={[styles.openButton, isOpening && styles.openButtonLoading]}
              onPress={handleOpenBarrier}
              disabled={isOpening || barrierOpened || isCanceling}
              activeOpacity={0.85}
            >
              {isOpening ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.openButtonIcon}>🚧</Text>
                  <Text style={styles.openButtonText}>Llegué: Abrir Barrera</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.openButton, isReserving && styles.openButtonLoading]}
              onPress={handleReserve}
              disabled={isReserving}
              activeOpacity={0.85}
            >
              {isReserving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.openButtonIcon}>✅</Text>
                  <Text style={styles.openButtonText}>Reservar</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Botón Cancelar Reserva (solo si ya está reservado) */}
          {token && (
            <TouchableOpacity
              style={[styles.cancelButton, isCanceling && styles.cancelButtonLoading]}
              onPress={handleCancelReservation}
              disabled={isOpening || barrierOpened || isCanceling}
              activeOpacity={0.85}
            >
              {isCanceling ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancelar Reserva</Text>
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.hint}>
            {token 
              ? 'Presiona el botón cuando estés frente a la barrera' 
              : 'Al confirmar se guardará tu espacio'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// ─── Sub-componente InfoChip ──────────────────────────────

const InfoChip: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <View style={styles.chip}>
    <Text style={styles.chipIcon}>{icon}</Text>
    <Text style={styles.chipLabel}>{label}</Text>
  </View>
);

// ─── Estilos ─────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 2,
    marginBottom: 16,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  chipIcon: { fontSize: 14 },
  chipLabel: {
    color: '#A5B4FC',
    fontSize: 13,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  qrLabel: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  tokenText: {
    color: 'rgba(148, 163, 184, 0.5)',
    fontSize: 11,
    fontFamily: 'monospace',
    maxWidth: 260,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    marginBottom: 20,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#6366F1',
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  openButtonLoading: {
    opacity: 0.7,
  },
  openButtonIcon: {
    fontSize: 20,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelButtonLoading: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  hint: {
    color: 'rgba(148, 163, 184, 0.6)',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  placeholderContainer: {
    width: 232,
    height: 232,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  placeholderIcon: {
    fontSize: 48,
    color: '#6366F1',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
