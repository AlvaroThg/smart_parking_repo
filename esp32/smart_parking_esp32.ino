#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ─── WiFi ─────────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "TU_WIFI_SSID";
const char* WIFI_PASSWORD = "TU_WIFI_PASSWORD";

// ─── HiveMQ Cloud (mismo broker que usa el backend) ───────────────────────────
const char* MQTT_HOST     = "202a9124a92341a6b566176001ee7326.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "AlvaroESP";
const char* MQTT_PASS     = "Alvaro0014";
const char* MQTT_CLIENT_ID = "esp32-smart-parking-001";

// ─── Tópicos (deben coincidir EXACTAMENTE con el backend) ────────────────────
const char* TOPIC_SENSORES = "smartparking/sensores";
const char* TOPIC_CONTROL  = "smartparking/control_puerta";

// ─── Pines de hardware ────────────────────────────────────────────────────────
// Sensores IR o ultrasonicos (LOW = objeto detectado = cajón OCUPADO)
const int PIN_SENSOR_A = 34;   // cajón A
const int PIN_SENSOR_B = 35;   // cajón B

// Servo de la barrera
const int PIN_SERVO    = 18;

// ─── Constantes servo ─────────────────────────────────────────────────────────
const int SERVO_CERRADO = 0;    // grados — barrera cerrada
const int SERVO_ABIERTO = 90;   // grados — barrera abierta
const int TIEMPO_ABIERTO_MS = 5000; // ms que permanece abierta

// ─── Intervalo de publicación de sensores ─────────────────────────────────────
const unsigned long INTERVALO_SENSORES_MS = 2000;

// ─── Objetos globales ─────────────────────────────────────────────────────────
WiFiClientSecure wifiClient;
PubSubClient     mqttClient(wifiClient);
Servo            servoBarrera;

unsigned long ultimaPublicacion = 0;

// ─── Prototipos ───────────────────────────────────────────────────────────────
void conectarWifi();
void conectarMqtt();
void publicarSensores();
void callbackMqtt(char* topic, byte* payload, unsigned int length);
void abrirBarrera();

// ──────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  pinMode(PIN_SENSOR_A, INPUT);
  pinMode(PIN_SENSOR_B, INPUT);

  servoBarrera.attach(PIN_SERVO);
  servoBarrera.write(SERVO_CERRADO);

  conectarWifi();

  // Para un proyecto universitario usamos setInsecure() — omite validación de
  // certificado del servidor. En producción real se usaría la CA de HiveMQ.
  wifiClient.setInsecure();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(callbackMqtt);
  mqttClient.setBufferSize(512);

  conectarMqtt();
}

void loop() {
  if (!mqttClient.connected()) {
    conectarMqtt();
  }
  mqttClient.loop();

  unsigned long ahora = millis();
  if (ahora - ultimaPublicacion >= INTERVALO_SENSORES_MS) {
    ultimaPublicacion = ahora;
    publicarSensores();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
void conectarWifi() {
  Serial.printf("Conectando a WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi conectado — IP: %s\n", WiFi.localIP().toString().c_str());
}

void conectarMqtt() {
  while (!mqttClient.connected()) {
    Serial.printf("Conectando a MQTT (%s:%d)...", MQTT_HOST, MQTT_PORT);
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println(" conectado!");
      // Suscribirse al tópico de control — aquí llega "ABRIR" desde el backend
      mqttClient.subscribe(TOPIC_CONTROL, 1);
      Serial.printf("Suscrito a: %s\n", TOPIC_CONTROL);
    } else {
      Serial.printf(" error rc=%d, reintentando en 5s\n", mqttClient.state());
      delay(5000);
    }
  }
}

// Llamado automáticamente por PubSubClient cuando llega un mensaje
void callbackMqtt(char* topic, byte* payload, unsigned int length) {
  String mensaje = "";
  for (unsigned int i = 0; i < length; i++) {
    mensaje += (char)payload[i];
  }
  Serial.printf("Mensaje recibido [%s]: %s\n", topic, mensaje.c_str());

  if (String(topic) == TOPIC_CONTROL && mensaje == "ABRIR") {
    abrirBarrera();
  }
}

// Publica el estado de ambos sensores al backend
void publicarSensores() {
  // Con sensor IR: LOW = objeto detectado = cajón OCUPADO
  bool ocupado_a = (digitalRead(PIN_SENSOR_A) == LOW);
  bool ocupado_b = (digitalRead(PIN_SENSOR_B) == LOW);

  StaticJsonDocument<128> doc;
  doc["ocupado_a"] = ocupado_a;
  doc["ocupado_b"] = ocupado_b;

  char buffer[128];
  serializeJson(doc, buffer);

  mqttClient.publish(TOPIC_SENSORES, buffer, true); // retain=true
  Serial.printf("Sensores publicados -> A:%s B:%s\n",
    ocupado_a ? "OCUPADO" : "LIBRE",
    ocupado_b ? "OCUPADO" : "LIBRE");
}

// Abre el servo y lo cierra después de TIEMPO_ABIERTO_MS
void abrirBarrera() {
  Serial.println(">>> ABRIENDO BARRERA <<<");
  servoBarrera.write(SERVO_ABIERTO);
  delay(TIEMPO_ABIERTO_MS);
  servoBarrera.write(SERVO_CERRADO);
  Serial.println(">>> BARRERA CERRADA <<<");
}
