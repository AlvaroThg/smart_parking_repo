import axios from 'axios';
import { Platform } from 'react-native';

/**
 * URL del backend detectada automáticamente según la plataforma.
 * - Para desarrollo web local usa: http://localhost:3000
 * - Para Expo Go en la red local física usa la IP de tu PC: http://172.22.28.145:3000
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://172.22.28.145:3000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});


// ─────────────────────────────────────────────────────────
//  Tipos de respuesta
// ─────────────────────────────────────────────────────────

export interface Estacionamiento {
  id: string;
  nombre: string;
  ubicacion_gps?: string;
  ocupado_a: boolean;
  ocupado_b: boolean;
  reservado_a: boolean;
  reservado_b: boolean;
  token_reserva_a?: string | null;
  token_reserva_b?: string | null;
}

export interface ReservaResponse {
  mensaje: string;
  token: string;
  estacionamiento: string;
  cajon: 'A' | 'B';
}

export interface AperturaResponse {
  mensaje: string;
  cajon: 'A' | 'B';
  estacionamiento: string;
}

export interface CancelacionResponse {
  mensaje: string;
  cajon: 'A' | 'B';
  estacionamiento: string;
}

// ─────────────────────────────────────────────────────────
//  Funciones de API
// ─────────────────────────────────────────────────────────

/**
 * GET /parking — Obtiene todos los estacionamientos y su estado.
 */
export async function getParkings(): Promise<Estacionamiento[]> {
  const { data } = await apiClient.get<Estacionamiento[]>('/parking');
  return data;
}

/**
 * POST /parking/reserve — Reserva un cajón y devuelve el token.
 */
export async function reserveSpot(
  parkingId: string,
  spot: 'A' | 'B',
): Promise<ReservaResponse> {
  const { data } = await apiClient.post<ReservaResponse>('/parking/reserve', {
    parkingId,
    spot,
  });
  return data;
}

/**
 * POST /parking/open — Valida el token y envía comando MQTT al ESP32.
 */
export async function openBarrier(token: string): Promise<AperturaResponse> {
  const { data } = await apiClient.post<AperturaResponse>('/parking/open', {
    token,
  });
  return data;
}

/**
 * POST /parking/cancel — Cancela la reserva activa y libera el cajón.
 */
export async function cancelReservation(token: string): Promise<CancelacionResponse> {
  const { data } = await apiClient.post<CancelacionResponse>('/parking/cancel', {
    token,
  });
  return data;
}
