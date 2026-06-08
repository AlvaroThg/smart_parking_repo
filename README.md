# 🚗 Smart Parking — Sistema IoT de Estacionamiento Inteligente

Sistema IoT completo con ESP32, MQTT, NestJS, Prisma + PostgreSQL y React Native (Expo).

---

## 📁 Estructura del Proyecto

```
smart_parking_repo/
├── backend/          # API NestJS
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── prisma/        # PrismaService (global)
│   │   ├── mqtt/          # MqttService (global, HiveMQ Cloud)
│   │   └── parking/       # Controlador, Servicio y DTOs
│   ├── .env.example
│   └── package.json
│
└── mobile/           # App React Native (Expo)
    ├── app/
    │   ├── _layout.tsx
    │   └── index.tsx      # Pantalla principal
    ├── components/
    │   ├── ParkingSpot.tsx
    │   └── QRModal.tsx
    ├── services/
    │   └── api.ts
    └── package.json
```

---

## 🚀 Setup del Backend

### 1. Instalar dependencias
```bash
cd backend
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Edita .env con tus credenciales de Supabase y HiveMQ Cloud
```

### 3. Generar cliente Prisma y sincronizar BD
```bash
npm run prisma:generate
npm run prisma:push
```

### 4. Insertar un estacionamiento de prueba (Prisma Studio)
```bash
npm run prisma:studio
```

### 5. Iniciar en modo desarrollo
```bash
npm run start:dev
```

La API quedará disponible en `http://localhost:3000`.

---

## 📱 Setup del Frontend (Mobile)

### 1. Instalar dependencias
```bash
cd mobile
npm install
```

### 2. Configurar la URL de la API
Edita `services/api.ts` y cambia `BASE_URL` por la IP de tu máquina:
- **Emulador Android:** `http://10.0.2.2:3000`
- **Dispositivo físico / Expo Go:** `http://192.168.X.X:3000`

O crea un archivo `.env` en la raíz del proyecto mobile:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

### 3. Iniciar Expo
```bash
npx expo start
```

---

## 🔌 Endpoints de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/parking` | Lista todos los estacionamientos y su estado |
| `POST` | `/parking/reserve` | Reserva un cajón y devuelve un token UUID |
| `POST` | `/parking/open` | Valida el token y publica `ABRIR` en MQTT |

### POST /parking/reserve — Body
```json
{
  "parkingId": "uuid-del-estacionamiento",
  "spot": "A"
}
```

### POST /parking/open — Body
```json
{
  "token": "uuid-token-de-reserva"
}
```

---

## 🌐 Tópicos MQTT

| Tópico | Dirección | Mensaje |
|--------|-----------|---------|
| `smartparking/control_puerta` | Backend → ESP32 | `ABRIR` |

---

## ⚙️ Variables de Entorno (Backend)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string de PostgreSQL (Supabase) |
| `MQTT_HOST` | Host de HiveMQ Cloud (sin protocolo) |
| `MQTT_PORT` | Puerto TLS (default: `8883`) |
| `MQTT_USERNAME` | Usuario MQTT |
| `MQTT_PASSWORD` | Contraseña MQTT |
| `PORT` | Puerto HTTP del servidor (default: `3000`) |

---

## 🏗️ Flujo del Sistema

```
[Usuario] → [App RN] ──HTTP──▶ [NestJS API] ──Prisma──▶ [PostgreSQL / Supabase]
                                     │
                                   MQTT (mqtts://)
                                     │
                              [HiveMQ Cloud] ──MQTT──▶ [ESP32]
                                                           │
                                                     [Servomotor / Barrera]
```

1. La app consulta `GET /parking` cada 10 segundos.
2. El usuario reserva un cajón → recibe un token UUID como QR.
3. Al llegar al parking, presiona "Abrir Barrera" → el token se valida.
4. El backend publica `ABRIR` en `smartparking/control_puerta`.
5. El ESP32 (suscrito a ese tópico) activa el servomotor.
