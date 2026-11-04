// Movimiento y transiciones de cámara del recorrido 3D.
//
// Aquí vive la cinemática "suave" (aceleración, frenado y giro interpolado) y el
// aplicador de desplazamientos. TODO desplazamiento pasa por el detector de
// colisiones de `colisiones3d.js`, de modo que ninguna forma de moverse
// (teclado, rueda, clic en el piso o acercamiento automático) atraviesa paredes.

import { fueraDeLimites } from './colisiones3d'

// Suaviza la velocidad hacia un objetivo con respuesta exponencial. Es
// independiente de los FPS (el factor se calcula con `dt`) y no cambia de golpe.
export function suavizarVelocidad(velocidad, objetivoX, objetivoZ, dt, tasa) {
  const factor = 1 - Math.exp(-tasa * dt)
  velocidad.vx += (objetivoX - velocidad.vx) * factor
  velocidad.vz += (objetivoZ - velocidad.vz) * factor
  if (Math.abs(velocidad.vx) < 1e-4) velocidad.vx = 0
  if (Math.abs(velocidad.vz) < 1e-4) velocidad.vz = 0
}

// Aplica un desplazamiento resolviendo X y Z por separado (permite deslizarse
// por las paredes en lugar de quedarse clavado). Devuelve true si algún eje
// quedó bloqueado y avisa con `alBloquear` de la malla que lo impidió.
export function aplicarDesplazamiento(posicion, dx, dz, detector, limites, alBloquear) {
  let bloqueado = false

  if (dx !== 0) {
    const destinoX = posicion.x + dx
    if (fueraDeLimites(destinoX, posicion.z, limites)) {
      bloqueado = true
    } else {
      const bloqueo = detector ? detector.bloquea(posicion.x, posicion.z, dx, 0, Math.abs(dx)) : null
      if (bloqueo) {
        bloqueado = true
        if (alBloquear) alBloquear(bloqueo)
      } else {
        posicion.x = destinoX
      }
    }
  }

  if (dz !== 0) {
    const destinoZ = posicion.z + dz
    if (fueraDeLimites(posicion.x, destinoZ, limites)) {
      bloqueado = true
    } else {
      const bloqueo = detector ? detector.bloquea(posicion.x, posicion.z, 0, dz, Math.abs(dz)) : null
      if (bloqueo) {
        bloqueado = true
        if (alBloquear) alBloquear(bloqueo)
      } else {
        posicion.z = destinoZ
      }
    }
  }

  return bloqueado
}

// Interpola un ángulo por el camino más corto (evita giros de 360°).
export function interpolarAngulo(actual, objetivo, dt, tasa) {
  const diferencia = Math.atan2(Math.sin(objetivo - actual), Math.cos(objetivo - actual))
  return actual + diferencia * (1 - Math.exp(-tasa * dt))
}

// Estado de una transición automática de cámara. `fijarYaw` decide si la
// transición también orienta la vista (acercamiento a una pieza) o solo mueve
// la posición (clic en el piso, que permite seguir mirando). `ruta` permite
// recorrer varios puntos intermedios (navegación entre salas).
export function crearTransicion() {
  return {
    activa: false,
    destino: null,
    ruta: null,
    indiceRuta: 0,
    alLlegar: null,
    tiempo: 0,
    duracionMax: 0,
    duracionMin: 0,
    fijarYaw: false,
  }
}

export function iniciarTransicion(
  transicion,
  destino,
  { alLlegar = null, duracionMax = 8, duracionMin = 0, fijarYaw = false } = {},
) {
  transicion.activa = true
  transicion.destino = destino
  transicion.ruta = null
  transicion.indiceRuta = 0
  transicion.alLlegar = alLlegar
  transicion.tiempo = 0
  transicion.duracionMax = duracionMax
  transicion.duracionMin = duracionMin
  transicion.fijarYaw = fijarYaw
}

// Igual que `iniciarTransicion`, pero recorre una lista de puntos intermedios.
// El último punto de `ruta` es el destino final y aporta la orientación.
export function iniciarRuta(
  transicion,
  ruta,
  { alLlegar = null, duracionMax = 30, duracionMin = 0 } = {},
) {
  if (!ruta || ruta.length === 0) return
  const final = ruta[ruta.length - 1]
  transicion.activa = true
  transicion.destino = final
  transicion.ruta = ruta
  transicion.indiceRuta = 0
  transicion.alLlegar = alLlegar
  transicion.tiempo = 0
  transicion.duracionMax = duracionMax
  transicion.duracionMin = duracionMin
  transicion.fijarYaw = typeof final.rotacionY === 'number'
}

// Cancela sin ejecutar el callback (por ejemplo, al empezar a arrastrar).
export function cancelarTransicion(transicion) {
  transicion.activa = false
  transicion.destino = null
  transicion.ruta = null
  transicion.indiceRuta = 0
  transicion.alLlegar = null
}

// Punto al que hay que dirigirse ahora mismo (intermedio o final).
export function objetivoActual(transicion) {
  if (transicion.ruta) return transicion.ruta[transicion.indiceRuta] || transicion.destino
  return transicion.destino
}

// ¿Quedan puntos intermedios tras el actual?
export function avanzarRuta(transicion) {
  if (!transicion.ruta) return false
  if (transicion.indiceRuta < transicion.ruta.length - 1) {
    transicion.indiceRuta += 1
    return true
  }
  return false
}

// Termina la transición ejecutando su callback, si lo tiene.
export function terminarTransicion(transicion) {
  const alLlegar = transicion.alLlegar
  cancelarTransicion(transicion)
  if (alLlegar) alLlegar()
}
