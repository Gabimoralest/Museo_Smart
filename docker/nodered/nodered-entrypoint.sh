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
#   Este script NO lee, crea ni modifica flows_cred.json ni ningun secreto.
#   El cifrado de credenciales de Node-RED queda intacto (se configura por UI).
#
# Arranque:
#   Delega en el entrypoint oficial de la imagen (no lo reemplaza funcionalmente).
# ============================================================
set -e

ORIGEN="/data-import/museo-smart-flows.json"
DESTINO="/data/flows.json"
MARCADOR_PLACEHOLDER="please check you have started this container with a volume"
MARCADOR_FLUJO_REAL="museo/sensores/ambiental"

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

# Delegar en el entrypoint oficial de la imagen (mismo userDir y FLOWS).
cd /usr/src/node-red
exec bash ./entrypoint.sh "$@"
