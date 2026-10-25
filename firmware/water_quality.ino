#include <WiFi.h>

#include <HTTPClient.h>

#include <ThingSpeak.h>

#include <Wire.h>

#include <LiquidCrystal_I2C.h>

#include <OneWire.h>

#include <DallasTemperature.h>

//====================== WiFi ======================

const char* ssid     = "SRC 24G";

const char* password = "src@internet";

WiFiClient client;

//================== Local Backend Server ====================

// Replace with the IP address of your computer running the Python backend

// (Run 'ipconfig' in command prompt to find your local IPv4 address)

const char* localServerUrl = "http://192.168.137.231:5000/api/reading";

//================== ThingSpeak ====================

unsigned long channelNumber = 178785;

const char * writeAPIKey = "NEQC9UNSYJYOVKSN";

//==================== LCD =========================

LiquidCrystal_I2C lcd(0x27, 16, 2);

//=================== Pins =========================

#define PH_PIN          34

#define TURBIDITY_PIN   35

#define EC_PIN          32

#define ONE_WIRE_BUS    33

#define BUZZER_PIN      27

//================ DS18B20 =========================

OneWire oneWire(ONE_WIRE_BUS);

DallasTemperature sensors(&oneWire);

//================ Variables =======================

float temperature = 0;

float phValue = 0;

float turbidity = 0;

float ecValue = 0;

// Raw ADC values

int phADC = 0;

int turbADC = 0;

int ecADC = 0;

// Calibration values

// Adjust according to your sensors

const float PH_OFFSET = 0.00;

const float EC_FACTOR = 2.50;

// Alarm limits

const float PH_LOW = 5.5;

const float PH_HIGH = 8.5;

const float TURBIDITY_LIMIT = 12.0;

const float EC_LIMIT = 800.0;

// Timing (Upload every 30 seconds to website & SQLite)

unsigned long lastUpload = 0;

const unsigned long uploadInterval = 30000; // 30 seconds interval

//==================================================

// Function Prototypes

//==================================================

void connectWiFi();

void readTemperature();

void readPH();

void readTurbidity();

void readEC();

void displayLCD();

void checkAlarm();

void uploadLocalServer();

void uploadLocalServer();

    uploadThingSpeak();

//==================================================

// Setup

//==================================================

void setup()

{

  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);

  analogReadResolution(12);

  lcd.init();

  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0,0);

  lcd.print("Water Quality");

  lcd.setCursor(0,1);

  lcd.print("Initializing");

  sensors.begin();

  connectWiFi();

  ThingSpeak.begin(client);

  delay(2000);

  lcd.clear();

}

//==================================================

// Connect WiFi

//==================================================

void connectWiFi()

{

  WiFi.mode(WIFI_STA);

  WiFi.begin(ssid, password);

  lcd.clear();

  lcd.setCursor(0,0);

  lcd.print("Connecting...");

  Serial.print("Connecting");

  while (WiFi.status() != WL_CONNECTED)

  {

    Serial.print(".");

    delay(500);

  }

  Serial.println();

  Serial.println("WiFi Connected");

  Serial.print("IP : ");

  Serial.println(WiFi.localIP());

  lcd.clear();

  lcd.setCursor(0,0);

  lcd.print("WiFi Connected");

  delay(1500);

}

//==================================================

// Read DS18B20 Temperature

//==================================================

void readTemperature()

{

  sensors.requestTemperatures();

  temperature = sensors.getTempCByIndex(0);

  if (temperature == DEVICE_DISCONNECTED_C)

  {

    Serial.println("Temperature Sensor Error!");

    temperature = 0;

  }

  Serial.print("Temperature : ");

  Serial.println(temperature);

}

//==================================================

// Read pH Sensor

//==================================================

void readPH()

{

  long sum = 0;

  for (int i = 0; i < 20; i++)

  {

    sum += analogRead(PH_PIN);

    delay(10);

  }

  phADC = sum / 20;

  float voltage = phADC * (3.3 / 4095.0);

  // Calibration equation

  phValue = 14 - ((2.5 - voltage) / 0.18);

  phValue += PH_OFFSET;

  Serial.print("pH ADC : ");

  Serial.print(phADC);

  Serial.print("   pH : ");

  Serial.println(phValue, 2);

}

//==================================================

// Read Turbidity Sensor

//==================================================

void readTurbidity()

{

  long sum = 0;

  for (int i = 0; i < 20; i++)

  {

    sum += analogRead(TURBIDITY_PIN);

    delay(10);

  }

  turbADC = (sum / 20)/10;

  float voltage = turbADC * (3.3 / 4095.0);

  // Approximate conversion

  turbidity = map(turbADC, 0, 4095, 100, 0);

  if (turbidity < 0)

    turbidity = 0;

  if (turbidity > 100)

    turbidity = 100;

  Serial.print("Turbidity ADC : ");

  Serial.print(turbADC);

  Serial.print("  Voltage : ");

  Serial.print(voltage);

  Serial.print("  NTU : ");

  Serial.println(turbidity);

}

//==================================================

// Read EC Sensor

//==================================================

void readEC()

{

  long sum = 0;

  for (int i = 0; i < 20; i++)

  {

    sum += analogRead(EC_PIN);

    delay(10);

  }

  ecADC = sum / 20;

  float voltage = ecADC * (3.3 / 4095.0);

  ecValue = (voltage * EC_FACTOR * 1000)-3500;

  Serial.print("EC ADC : ");

  Serial.print(ecADC);

  Serial.print("  EC : ");

  Serial.println(ecValue);

}

//==================================================

// LCD Display

//==================================================

void displayLCD()

{

  lcd.clear();

  lcd.setCursor(0,0);

  lcd.print("pH:");

  lcd.print(phValue,1);

  lcd.print(" T:");

  lcd.print(temperature,1);

  lcd.setCursor(0,1);

  lcd.print("Tu:");

  lcd.print(turbidity,0);

  lcd.print(" E:");

  lcd.print(ecValue,0);

}

//==================================================

// Alarm

//==================================================

void checkAlarm()

{

  bool alarm = false;

  if (phValue < PH_LOW)

    alarm = true;

  if (phValue > PH_HIGH)

    alarm = true;

  if (turbidity > TURBIDITY_LIMIT)

    alarm = true;

  if (ecValue > EC_LIMIT)

    alarm = true;

  if (alarm)

  {

    digitalWrite(BUZZER_PIN, HIGH);

  }

  else

  {

    digitalWrite(BUZZER_PIN, LOW);

  }

}

//==================================================

// Upload Data to ThingSpeak

//==================================================

void uploadThingSpeak()

{

  if (WiFi.status() != WL_CONNECTED)

  {

    Serial.println("WiFi Lost! Reconnecting...");

    connectWiFi();

  }

  ThingSpeak.setField(1, phValue);

  ThingSpeak.setField(2, turbidity);

  ThingSpeak.setField(3, ecValue);

  ThingSpeak.setField(4, temperature);

  int status = ThingSpeak.writeFields(channelNumber, writeAPIKey);

  Serial.print("ThingSpeak Status : ");

  if (status == 200)

  {

    Serial.println("Upload Successful");

    lcd.clear();

    lcd.setCursor(0,0);

    lcd.print("Data Uploaded");

    lcd.setCursor(0,1);

    lcd.print("ThingSpeak OK");

    delay(1500);

  }

  else

  {

    Serial.print("Error Code : ");

    Serial.println(status);

    lcd.clear();

    lcd.setCursor(0,0);

    lcd.print("Upload Failed");

    lcd.setCursor(0,1);

    lcd.print("Code:");

    lcd.print(status);

    delay(1500);

  }

}

//==================================================

// Main Loop

//==================================================

//==================================================

// Upload Data to Local Flask Server & SQLite DB

//==================================================

void uploadLocalServer()

{

  if (WiFi.status() != WL_CONNECTED)

  {

    Serial.println("WiFi Lost! Reconnecting...");

    connectWiFi();

    if (WiFi.status() != WL_CONNECTED) return;

  }

  HTTPClient http;

  http.begin(localServerUrl);

  http.addHeader("Content-Type", "application/json");

  // Construct JSON containing all 4 sensor readings

  String jsonPayload = "{";

  jsonPayload += "\"ph\":" + String(phValue, 2) + ",";

  jsonPayload += "\"turbidity\":" + String(turbidity, 2) + ",";

  jsonPayload += "\"ec\":" + String(ecValue, 2) + ",";

  jsonPayload += "\"temperature\":" + String(temperature, 2);

  jsonPayload += "}";

  Serial.println("[HTTP] Sending sensor readings to local website & SQLite...");

  Serial.print("[HTTP] URL: ");

  Serial.println(localServerUrl);

  Serial.print("[HTTP] Payload: ");

  Serial.println(jsonPayload);

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0)

  {

    Serial.print("[HTTP] POST Result Code: ");

    Serial.println(httpCode);

    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED)

    {

      String response = http.getString();

      Serial.print("[HTTP] Server Response: ");

      Serial.println(response);

      lcd.clear();

      lcd.setCursor(0, 0);

      lcd.print("Saved to SQLite");

      lcd.setCursor(0, 1);

      lcd.print("Local Server OK");

      delay(1200);

    }

  }

  else

  {

    Serial.print("[HTTP] POST failed, error: ");

    Serial.println(http.errorToString(httpCode).c_str());

  }

  http.end();

}

void loop()

{

  // Read all sensors

  readTemperature();

  readPH();

  readTurbidity();

  readEC();

  // Display values

  displayLCD();

  // Check alarm conditions

  checkAlarm();

  // Serial Monitor

  Serial.println("--------------------------------");

  Serial.print("Temperature : ");

  Serial.print(temperature);

  Serial.println(" C");

  Serial.print("pH          : ");

  Serial.println(phValue, 2);

  Serial.print("Turbidity   : ");

  Serial.print(turbidity);

  Serial.println(" NTU");

  Serial.print("EC          : ");

  Serial.print(ecValue);

  Serial.println(" uS/cm");

  Serial.println("--------------------------------");

  // Upload every 20 seconds

  if (millis() - lastUpload >= uploadInterval)

  {

    lastUpload = millis();

    uploadLocalServer();

    uploadThingSpeak();

  }

  delay(1000);

}
