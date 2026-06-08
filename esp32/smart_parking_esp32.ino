#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>

// --- Pines HC-SR04 ---
const int trigEspacioB = 5;
const int echoEspacioB = 18;
const int trigEspacioA = 19;
const int echoEspacioA = 21;
const int trigPuerta   = 22;
const int echoPuerta   = 23;
const int pinServo     = 13;

// --- Umbrales ---
const float UMBRAL_ESPACIO = 20.0; // cm — cajón ocupado si objeto detectado
const float UMBRAL_PUERTA  = 30.0; // cm — auto en puerta si objeto detectado

// --- WiFi ---
const char* ssid     = "Familia Rodriguez";
const char* password = "281257NO";

// --- HiveMQ Cloud ---
const char* mqtt_server = "202a9124a92341a6b566176001ee7326.s1.eu.hivemq.cloud";
const int   mqtt_port   = 8883;
const char* mqtt_user   = "AlvaroESP";
const char* mqtt_pass   = "Alvaro0014";

const char* TOPIC_SENSORES = "smartparking/sensores";
const char* TOPIC_CONTROL  = "smartparking/control_puerta";

// --- Cooldown entre aperturas automáticas ---
// Evita que la barrera se abra repetidamente si el auto sigue frente al sensor.
const unsigned long COOLDOWN_PUERTA_MS = 10000; // 10 segundos

WiFiClientSecure espClient;
PubSubClient     client(espClient);
Servo            barrera;

bool           espacioA_ocupado = false;
bool           espacioB_ocupado = false;
unsigned long  ultimoEnvio      = 0;
unsigned long  ultimaApertura   = 0;
const long     INTERVALO        = 2000;

void setup_wifi();
void reconnect();
void callback(char* topic, byte* payload, unsigned int length);
float obtenerDistancia(int trigPin, int echoPin);
void abrirBarrera();

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  pinMode(trigPuerta,   OUTPUT); pinMode(echoPuerta,   INPUT);
  pinMode(trigEspacioA, OUTPUT); pinMode(echoEspacioA, INPUT);
  pinMode(trigEspacioB, OUTPUT); pinMode(echoEspacioB, INPUT);

  ESP32PWM::allocateTimer(0);
  barrera.setPeriodHertz(50);
  barrera.attach(pinServo, 500, 2400);
  barrera.write(0); // barrera cerrada al inicio

  setup_wifi();
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setBufferSize(512);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // 1. Leer sensores de los cajones A y B
  float distA = obtenerDistancia(trigEspacioA, echoEspacioA);
  float distB = obtenerDistancia(trigEspacioB, echoEspacioB);
  espacioA_ocupado = (distA > 0 && distA <= UMBRAL_ESPACIO);
  espacioB_ocupado = (distB > 0 && distB <= UMBRAL_ESPACIO);

  // 2. Sensor de puerta — abre automáticamente si hay espacio y cooldown cumplido.
  //    Modo "walk-in": cualquier auto que se acerque entra si hay lugar.
  //    Modo "QR": la apertura la dispara el backend vía MQTT (ver callback).
  float distPuerta = obtenerDistancia(trigPuerta, echoPuerta);
  bool  autoEnPuerta = (distPuerta > 0 && distPuerta <= UMBRAL_PUERTA);
  bool  hayEspacio   = (!espacioA_ocupado || !espacioB_ocupado);

  if (autoEnPuerta && hayEspacio && (millis() - ultimaApertura > COOLDOWN_PUERTA_MS)) {
    Serial.println("Auto en puerta con espacio libre → Abriendo (modo automático)");
    ultimaApertura = millis();
    abrirBarrera();
  } else if (autoEnPuerta && !hayEspacio) {
    Serial.println("Auto en puerta pero parqueo LLENO → barrera cerrada");
  }

  // 3. Publicar estado de los cajones a la nube cada INTERVALO ms
  unsigned long ahora = millis();
  if (ahora - ultimoEnvio > INTERVALO) {
    ultimoEnvio = ahora;

    String payload = "{\"puerta\":"   + String(distPuerta)  +
                     ",\"espacioA\":" + String(distA)        +
                     ",\"espacioB\":" + String(distB)        +
                     ",\"ocupado_a\":" + (espacioA_ocupado ? "true" : "false") +
                     ",\"ocupado_b\":" + (espacioB_ocupado ? "true" : "false") + "}";

    client.publish(TOPIC_SENSORES, payload.c_str());

    Serial.printf("→ Puerta: %.1f cm | A: %s (%.1f cm) | B: %s (%.1f cm)\n",
                  distPuerta,
                  espacioA_ocupado ? "LLENO" : "LIBRE", distA,
                  espacioB_ocupado ? "LLENO" : "LIBRE", distB);
  }

  delay(50);
}

// Recibe comando "ABRIR" del backend (modo QR/app)
void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("MQTT [%s]: %s\n", topic, msg.c_str());

  if (msg == "ABRIR") {
    Serial.println("Comando ABRIR vía MQTT → Abriendo barrera (modo QR)");
    abrirBarrera();
    ultimaApertura = millis(); // reinicia el cooldown del sensor de puerta
  }
}

// Abre la barrera 5 segundos y la cierra
void abrirBarrera() {
  Serial.println(">>> BARRERA ABIERTA <<<");
  barrera.write(90);
  delay(5000);
  barrera.write(0);
  Serial.println(">>> BARRERA CERRADA <<<");
}

float obtenerDistancia(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long dur = pulseIn(echoPin, HIGH, 30000);
  if (dur == 0) return -1;
  return (dur * 0.0343) / 2.0;
}

void setup_wifi() {
  Serial.printf("Conectando a WiFi: %s", ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\nWiFi conectado — IP: %s\n", WiFi.localIP().toString().c_str());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Conectando a HiveMQ Cloud...");
    if (client.connect("ESP32_SmartParking", mqtt_user, mqtt_pass)) {
      Serial.println(" conectado!");
      client.subscribe(TOPIC_CONTROL, 1);
    } else {
      Serial.printf(" error rc=%d, reintentando en 5s\n", client.state());
      delay(5000);
    }
  }
}
