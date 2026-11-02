# AutoMac Pinar del Río — simulador 3D

Simulador independiente desarrollado en React, TypeScript y Three.js. Representa la cola inicial, dos citófonos paralelos, una ventanilla de pago y una de entrega. Se utiliza una vista 3D para observar el tránsito y la detención de cada vehículo.

## Ejecutar en Windows

1. Descomprime el ZIP y abre la carpeta **`mc-simulator`**.
2. Ejecuta `INICIAR_WINDOWS.bat` o abre una terminal en esa carpeta.
3. En PowerShell, ejecuta:

```powershell
npm.cmd install
npm.cmd run dev
```

4. Abre la dirección que muestre Vite, normalmente `http://localhost:5173/`.

Para detener el servidor usa `Ctrl+C`.

## Reglas del simulador

- **Hora base:** lunes a las **09:58:00** (internamente, para aplicar el ciclo de siete días sin pedir un día al usuario). En ese momento el establecimiento está cerrado.
- **Primera apertura:** 10:00:00. El reloj transcurre los dos minutos de espera sin saltarse el tiempo.
- **Llegadas continuas:** durante cada tramo de apertura se generan intervalos aleatorios exponenciales con la media seleccionada. No existe una cantidad máxima de vehículos ni una duración fija de generación.
- **Durante el cierre:** no se admiten nuevas llegadas. Los vehículos que ya han ingresado al sistema terminan su atención, aunque el establecimiento esté cerrado.
- **Reapertura:** al iniciarse el siguiente turno se reanudan automáticamente las llegadas aleatorias.
- **Reloj y velocidad:** el indicador avanza con la velocidad × seleccionada; se congela al pausar. «Reiniciar» vuelve a las 09:58 y reinicia los contadores.
- **Recorrido:** entrada única → uno de los dos citófonos → unión de carriles → pago → entrega → salida. La circulación conserva separación mínima de seguridad y evita que dos automóviles ocupen una misma posición. Los vehículos que exceden la entrada disponible esperan fuera del tramo dibujado.

## Parámetros

| Parámetro | Significado |
|---|---|
| Intervalo medio entre llegadas (s) | Media de un tiempo exponencial entre vehículos, durante los periodos abiertos; la tasa media de llegadas es λ = 3600 / intervalo |
| Pedido (s) | Tiempo medio de atención por citófono; hay dos servidores paralelos |
| Pago (s) | Tiempo medio de atención de una ventanilla |
| Entrega (s) | Tiempo medio de atención de una ventanilla |
| Velocidad × | Factor de avance del reloj respecto al tiempo real; no altera los tiempos simulados |

**Distribuciones:** los intervalos entre llegadas son exponenciales. Los servicios se generan con distribuciones triangulares acotadas al ±35 % respecto al promedio configurado. Por tanto, el motor actual simula una **red de colas con llegadas markovianas y tiempos de servicio triangulares**; no debe describirse matemáticamente como una red M/M/2 → M/M/1 → M/M/1 estricta mientras no se cambien los servicios a exponenciales.

**Datos:** los valores iniciales son supuestos, no resultados observados. La representación geométrica se basa en el croquis suministrado y no reproduce distancias medidas de la sede. Las velocidades de desplazamiento son parámetros de visualización. Para un estudio estadístico se debe calibrar y validar el sistema con los registros reales de llegada y servicio.

## Arquitectura

- `src/model/clock.ts`: apertura, cierre, reapertura, reloj y transiciones del ciclo semanal.
- `src/model/engine.ts`: entidades, tiempos de llegada y atención, colas, distancias entre vehículos y métricas.
- `src/model/routes.ts`: trazado geométrico de los carriles.
- `src/components/World3D.tsx`: edificio, vehículos y visualización 3D.
- `src/App.tsx`: presentación inicial, variables, controles y paneles.
- `src/styles.css`: interfaz azul claro.

## Verificación

`npm.cmd run typecheck` verifica TypeScript. `npm.cmd run build` genera la versión de producción. Ambas órdenes requieren ejecutar `npm.cmd install` previamente. El equipo debe tener una instalación de Node.js compatible con Vite 7.



