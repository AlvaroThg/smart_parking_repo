import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { openBarrier, cancelReservation, reserveSpot } from '../services/api';

interface QRModalProps {
  visible: boolean;
  token: string | null;
  cajon: 'A' | 'B';
  estacionamiento: string;
  parkingId: string;
  onClose: () => void;
  onSuccess: () => void;
  onReserved: (token: string) => void;
}

const C = {
  bg: '#0F1E30',
  elevated: '#162840',
  gold: '#C9A84C',
  goldGlow: 'rgba(201,168,76,0.10)',
  goldBorder: 'rgba(201,168,76,0.28)',
  cream: '#EDE6D3',
  muted: '#7A8FA6',
  mutedFaint: 'rgba(122,143,166,0.15)',
  crimsonBg: 'rgba(229,62,62,0.08)',
  crimsonBorder: 'rgba(229,62,62,0.28)',
  crimson: '#E05050',
  errorBg: 'rgba(229,62,62,0.10)',
};

const serif = Platform.select({ web: '"Playfair Display", Georgia, serif', default: undefined });
const sans  = Platform.select({ web: '"Inter", system-ui, sans-serif',      default: undefined });
const mono  = Platform.select({ web: '"Courier New", monospace',            default: 'monospace' });

export const QRModal: React.FC<QRModalProps> = ({
  visible, token, cajon, estacionamiento, parkingId,
  onClose, onSuccess, onReserved,
}) => {
  const [isOpening,   setIsOpening]   = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const busy = isOpening || isCanceling || isReserving;

  const handleOpenBarrier = async () => {
    if (!token) return;
    setErrorMsg(null);
    setIsOpening(true);
    try {
      await openBarrier(token);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? 'No se pudo abrir la barrera.');
    } finally {
      setIsOpening(false);
    }
  };

  const handleReserve = async () => {
    setErrorMsg(null);
    setIsReserving(true);
    try {
      const res = await reserveSpot(parkingId, cajon);
      onReserved(res.token);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? 'No se pudo completar la reserva.');
    } finally {
      setIsReserving(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!token) return;
    setErrorMsg(null);
    setIsCanceling(true);
    try {
      await cancelReservation(token);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? 'No se pudo cancelar la reserva.');
      setShowConfirm(false);
    } finally {
      setIsCanceling(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setErrorMsg(null);
    setShowConfirm(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{token ? 'Tu Reserva' : 'Reservar Cajón'}</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn} disabled={busy}>
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Info chips */}
          <View style={s.chips}>
            <Chip icon="🏢" label={estacionamiento} />
            <Chip icon="🅿" label={`Cajón ${cajon}`} />
          </View>

          {/* QR / placeholder */}
          <View style={s.qrArea}>
            {token ? (
              <>
                <View style={s.qrBox}>
                  <QRCode value={token} size={190} color="#0F1E30" backgroundColor="#FFF" quietZone={12} />
                </View>
                <Text style={s.qrHint}>Presenta este código en la barrera</Text>
                <Text style={s.tokenTxt} numberOfLines={1} ellipsizeMode="middle">{token}</Text>
              </>
            ) : (
              <View style={s.placeholder}>
                <Text style={s.placeholderIcon}>🔑</Text>
                <Text style={s.placeholderTxt}>Confirma tu reserva para generar el código QR de acceso</Text>
              </View>
            )}
          </View>

          {/* Error inline */}
          {errorMsg ? (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>⚠  {errorMsg}</Text>
            </View>
          ) : null}

          <View style={s.divider} />

          {/* Confirm cancel view */}
          {showConfirm ? (
            <View style={s.confirmBox}>
              <Text style={s.confirmQ}>¿Cancelar tu reserva del Cajón {cajon}?</Text>
              <Text style={s.confirmSub}>El espacio quedará disponible para otros.</Text>
              <View style={s.confirmRow}>
                <TouchableOpacity style={s.confirmNo} onPress={() => setShowConfirm(false)} disabled={isCanceling}>
                  <Text style={s.confirmNoTxt}>No, volver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.confirmYes} onPress={handleCancelConfirm} disabled={isCanceling}>
                  {isCanceling
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.confirmYesTxt}>Sí, cancelar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Primary action */}
              {token ? (
                <TouchableOpacity style={[s.primaryBtn, busy && s.btnDim]} onPress={handleOpenBarrier} disabled={busy}>
                  {isOpening
                    ? <ActivityIndicator color="#08121E" />
                    : <Text style={s.primaryBtnTxt}>Llegué · Abrir Barrera</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.primaryBtn, busy && s.btnDim]} onPress={handleReserve} disabled={busy}>
                  {isReserving
                    ? <ActivityIndicator color="#08121E" />
                    : <Text style={s.primaryBtnTxt}>Confirmar Reserva</Text>}
                </TouchableOpacity>
              )}

              {/* Cancel */}
              {token ? (
                <TouchableOpacity style={[s.cancelBtn, busy && s.btnDim]} onPress={() => setShowConfirm(true)} disabled={busy}>
                  <Text style={s.cancelBtnTxt}>Cancelar Reserva</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          <Text style={s.footer}>
            {token
              ? 'La barrera se abrirá al validar tu código'
              : 'El cajón quedará reservado a tu nombre'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const Chip = ({ icon, label }: { icon: string; label: string }) => (
  <View style={s.chip}>
    <Text style={s.chipIcon}>{icon}</Text>
    <Text style={s.chipLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.goldBorder,
    paddingHorizontal: 24,
    paddingBottom: 44,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 3,
    backgroundColor: C.goldBorder,
    borderRadius: 2,
    marginBottom: 18,
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
    fontWeight: '700',
    color: C.cream,
    fontFamily: serif,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.mutedFaint,
  },
  closeX: { color: C.muted, fontSize: 13, fontFamily: sans },
  chips: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.goldGlow,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  chipIcon: { fontSize: 13 },
  chipLabel: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: sans,
    letterSpacing: 0.3,
  },
  qrArea: { alignItems: 'center', marginBottom: 16 },
  qrBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  qrHint: {
    color: C.muted,
    fontSize: 12,
    marginTop: 14,
    marginBottom: 4,
    fontFamily: sans,
  },
  tokenTxt: {
    color: 'rgba(122,143,166,0.45)',
    fontSize: 10,
    fontFamily: mono,
    maxWidth: 260,
  },
  placeholder: {
    width: 218,
    height: 218,
    backgroundColor: C.goldGlow,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  placeholderIcon: { fontSize: 44 },
  placeholderTxt: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: sans,
  },
  errorBox: {
    width: '100%',
    backgroundColor: C.errorBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorTxt: {
    color: C.crimson,
    fontSize: 13,
    fontFamily: sans,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: C.mutedFaint,
    marginBottom: 20,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  btnDim: { opacity: 0.55 },
  primaryBtnTxt: {
    color: '#08121E',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: sans,
    letterSpacing: 0.3,
  },
  cancelBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    backgroundColor: C.crimsonBg,
    marginBottom: 4,
  },
  cancelBtnTxt: {
    color: C.crimson,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: sans,
    letterSpacing: 0.2,
  },
  confirmBox: {
    width: '100%',
    backgroundColor: C.crimsonBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    padding: 16,
    marginBottom: 4,
    gap: 6,
  },
  confirmQ: {
    color: C.cream,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: serif,
  },
  confirmSub: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: sans,
    marginBottom: 6,
  },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmNo: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.mutedFaint,
  },
  confirmNoTxt: {
    color: C.muted,
    fontWeight: '600',
    fontSize: 14,
    fontFamily: sans,
  },
  confirmYes: {
    flex: 2,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#5C1020',
    borderWidth: 1,
    borderColor: C.crimsonBorder,
  },
  confirmYesTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: sans,
  },
  footer: {
    color: 'rgba(122,143,166,0.45)',
    fontSize: 11,
    marginTop: 14,
    textAlign: 'center',
    fontFamily: sans,
  },
});
