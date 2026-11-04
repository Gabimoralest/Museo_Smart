#!/bin/bash
# ============================================================
# Museo_Smart - Entrypoint de Node-RED
# ------------------------------------------------------------
# Objetivo (B3): cargar automaticamente el flujo de Museo_Smart en
# /data/flows.json de forma idempotente y sin pisar un flujo ya configurado.
#
# Contexto importante:
#   La imagen oficial nodered/node-red:4.0.9 hace "COPY flows.json /data" en
#   su Dockerfile. Por tanto, la PRIMERA vez que se crea el volumen
#   nodered_data, /data/flows.json YA existe, pero con un flujo de ejemplo
#   que solo contiene un aviso ("please check you have started this container
#   with a volume..."). Un chequeo estricto de "no existe" nunca copiaria.
#
#   Por eso solo se siembra cuando:
#     a) /data/flows.json no existe, o
#     b) /data/flows.json es exactamente el placeholder de la imagen
#        (contiene su aviso y NO contiene el topico de Museo_Smart).
#   En cualquier otro caso el flujo existente se respeta intacto.
#
# Credenciales:
#   Este script NUNCA escribe valores secretos. Solo, cuando el volumen es
#   nuevo (no existe /data/flows_cred.json), siembra las credenciales del nodo
#   MQTT como REFERENCIAS de entorno ("${MQTT_USERNAME}", "${MQTT_PASSWORD}").
#   Node-RED sustituye esas referencias al instanciar el nodo, tomando los
#   valores de las variables de entorno del contenedor (definidas en
#   docker-compose.yml). Si ya existe un flows_cred.json, se respeta intacto.
#
# Arranque:
#   Delega en el entrypoint oficial de la imagen (no lo reemplaza funcionalmente).
# ============================================================
set -e

ORIGEN="/data-import/museo-smart-flows.json"
DESTINO="/data/flows.json"
CREDENCIALES="/data/flows_cred.json"
MARCADOR_PLACEHOLDER="please check you have started this container with a volume"
MARCADOR_FLUJO_REAL="museo/sensores/ambiental"
ID_BROKER_MQTT="4c080e9182914b84"

if [ ! -f "$ORIGEN" ]; then
    echo "[seeder] ERROR: no se encontro el flujo de origen en $ORIGEN" >&2
    exit 1
fi

if [ ! -f "$DESTINO" ]; then
    echo "[seeder] $DESTINO no existe; se siembra el flujo de Museo_Smart."
    cp "$ORIGEN" "$DESTINO"
elif grep -q "$MARCADOR_PLACEHOLDER" "$DESTINO" 2>/dev/null \
     && ! grep -q "$MARCADOR_FLUJO_REAL" "$DESTINO" 2>/dev/null; then
    echo "[seeder] $DESTINO es el placeholder de la imagen; se siembra el flujo de Museo_Smart."
    cp "$ORIGEN" "$DESTINO"
else
    echo "[seeder] $DESTINO ya esta configurado; no se sobrescribe."
fi

# Credenciales del broker MQTT SOLO la primera vez. Son referencias de entorno,
# no secretos: Node-RED las resuelve con MQTT_USERNAME / MQTT_PASSWORD del
# contenedor. Si el archivo ya existe (aunque este cifrado), no se toca.
if [ ! -f "$CREDENCIALES" ]; then
    echo "[seeder] $CREDENCIALES no existe; se siembran referencias de entorno para el broker MQTT."
    cat > "$CREDENCIALES" <<EOF
{
    "$ID_BROKER_MQTT": {
        "user": "\${MQTT_USERNAME}",
        "password": "\${MQTT_PASSWORD}"
    }
}
EOF
else
    echo "[seeder] $CREDENCIALES ya existe; no se sobrescribe."
fi

# Delegar en el entrypoint oficial de la imagen (mismo userDir y FLOWS).
cd /usr/src/node-red
exec bash ./entrypoint.sh "$@"
