#!/bin/sh
# ============================================================
# Entrypoint Mosquitto Museo_Smart
# Genera el archivo de contrasenas en el volumen de datos (no se versiona),
# le asigna propietario 'mosquitto' y permiso 0700, y arranca el broker.
# ============================================================
set -e

PASSWD_FILE=/mosquitto/data/passwd

if [ -z "$MQTT_USERNAME" ] || [ -z "$MQTT_PASSWORD" ]; then
  echo "ERROR: MQTT_USERNAME / MQTT_PASSWORD no definidos." >&2
  exit 1
fi

# Se regenera en cada arranque a partir del entorno.
rm -f "$PASSWD_FILE"
mosquitto_passwd -b -c "$PASSWD_FILE" "$MQTT_USERNAME" "$MQTT_PASSWORD"
chown mosquitto:mosquitto "$PASSWD_FILE"
chmod 0700 "$PASSWD_FILE"

exec mosquitto -c /mosquitto/config/mosquitto.conf
