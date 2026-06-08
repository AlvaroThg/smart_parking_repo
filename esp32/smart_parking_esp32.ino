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
const float UMBRAL_ESPACIO = 20.0; // cm — cajón ocupado si distancia <= umbral
const float UMBRAL_PUERTA  = 30.0; // cm — auto en puerta si distancia <= umbral

// --- WiFi ---
const char* ssid     = "Familia Rodriguez";
const char* password = "281257NO";

// --- HiveMQ Cloud ---
const char* mqtt_server = "202a9124a92341a6b566176001ee7326.s1.eu.hivemq.cloud";
const int   mqtt_port   = 8883;
const char* mqtt_user   = "AlvaroESP";
const char* mqtt_pass   = "Alvaro0014";

// --- Tópicos ---
const char* TOPIC_SENSORES = "smartparking/sensores";
const char* TOPIC_CONTROL  = "smartparking/control_puerta";

WiFiClientSecure espClient;
PubSubClient     client(espClient);
Servo            barrera;

bool espacioA_ocupado = false;
bool espacioB_ocupado = false;
unsigned long ultimoEnvio = 0;
const long INTERVALO = 2000;

// --- Prototipos ---
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
  barrera.write(0); // cerrada

  setup_wifi();

  espClient.setInsecure(); // TLS sin validar certificado del servidor
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback); // ← REGISTRAR el callback (era el bug crítico)
  client.setBufferSize(512);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop(); // procesa mensajes MQTT entrantes

  // 1. Leer sensores de espacios
  float distA = obtenerDistancia(trigEspacioA, echoEspacioA);
  float distB = obtenerDistancia(trigEspacioB, echoEspacioB);

  espacioA_ocupado = (distA > 0 && distA <= UMBRAL_ESPACIO);
  espacioB_ocupado = (distB > 0 && distB <= UMBRAL_ESPACIO);

  // 2. Publicar estado a la nube cada INTERVALO ms
  unsigned long ahora = millis();
  if (ahora - ultimoEnvio > INTERVALO) {
    ultimoEnvio = ahora;

    // El sensor de puerta se envía informativo; la apertura la decide el backend
    float distPuerta = obtenerDistancia(trigPuerta, echoPuerta);

    String payload = "{\"puerta\":"  + String(distPuerta)  +
                     ",\"espacioA\":" + String(distA)        +
                     ",\"espacioB\":" + String(distB)        +
                     ",\"ocupado_a\":" + (espacioA_ocupado ? "true" : "false") +
                     ",\"ocupado_b\":" + (espacioB_ocupado ? "true" : "false") + "}";

    client.publish(TOPIC_SENSORES, payload.c_str());

    Serial.printf("Publicado -> Puerta: %.1f cm | A: %s (%.1f cm) | B: %s (%.1f cm)\n",
                  distPuerta,
                  espacioA_ocupado ? "LLENO" : "LIBRE", distA,
                  espacioB_ocupado ? "LLENO" : "LIBRE", distB);
  }

  delay(50);
}

// Llamado por PubSubClient al recibir mensaje en TOPIC_CONTROL
void callback(char* topic, byte* payload, unsigned int length) {
  String mensaje = "";
  for (unsigned int i = 0; i < length; i++) mensaje += (char)payload[i];

  Serial.printf("Mensaje recibido [%s]: %s\n", topic, mensaje.c_str());

  // El backend solo envía "ABRIR" tras validar el token QR del usuario
  if (mensaje == "ABRIR") {
    if (!espacioA_ocupado || !espacioB_ocupado) {
      abrirBarrera();
    } else {
      Serial.println("Parqueo lleno — barrera no abre aunque llegó ABRIR.");
    }
  }
}

void abrirBarrera() {
  Serial.println(">>> ABRIENDO BARRERA <<<");
  barrera.write(90);
  delay(5000); // barrera abierta 5 segundos
  barrera.write(0);
  Serial.println(">>> BARRERA CERRADA <<<");
}

float obtenerDistancia(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duracion = pulseIn(echoPin, HIGH, 30000);
  if (duracion == 0) return -1;
  return (duracion * 0.0343) / 2.0;
}

void setup_wifi() {
  Serial.printf("Conectando a WiFi: %s", ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi conectado — IP: %s\n", WiFi.localIP().toString().c_str());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Conectando a HiveMQ Cloud...");
    if (client.connect("ESP32_SmartParking", mqtt_user, mqtt_pass)) {
      Serial.println(" conectado!");
      client.subscribe(TOPIC_CONTROL, 1); // QoS 1 para garantizar entrega
      Serial.printf("Suscrito a: %s\n", TOPIC_CONTROL);
    } else {
      Serial.printf(" error rc=%d, reintentando en 5s\n", client.state());
      delay(5000);
    }
  }
}
