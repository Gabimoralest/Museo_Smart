# syntax=docker/dockerfile:1
# ============================================================
# Museo_Smart - Backend (Spring Boot 3.3.4 / Java 21)
# ------------------------------------------------------------
# ARCHIVO NUEVO (propuesta). El proyecto no tenía Dockerfile.
# Ubicación sugerida: backend/Dockerfile
# Build desde la raíz del repo:
#   docker build -f backend/Dockerfile -t museosmart-backend backend
# ============================================================

# ---------- Etapa 1: compilación ----------
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Cachea dependencias antes de copiar el código
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
# Los tests de integración requieren PostgreSQL (RUN_DB_IT) y no deben
# ejecutarse durante la imagen. Se omiten explícitamente.
RUN mvn -B -q -DskipTests package

# ---------- Etapa 2: ejecución ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Usuario sin privilegios
RUN addgroup -S museo && adduser -S museo -G museo

COPY --from=build /workspace/target/museo-smart-backend-*.jar /app/app.jar
RUN chown -R museo:museo /app
USER museo

EXPOSE 8080

# Variables por defecto aptas para la red interna de Compose.
# Se pueden sobrescribir desde compose/environment.
ENV SERVER_PORT=8080 \
    DB_URL=jdbc:postgresql://postgres:5432/Museo_Smart \
    DB_USERNAME=postgres \
    MQTT_BROKER_URL=tcp://mosquitto:1883 \
    INFLUX_URL=http://influxdb:8086

# wget de BusyBox está disponible en la imagen alpine.
HEALTHCHECK --interval=20s --timeout=10s --start-period=40s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${SERVER_PORT}/actuator/health" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
