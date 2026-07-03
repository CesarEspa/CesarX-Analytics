# CesarX Analytics — ETF Intelligence Platform

Plataforma full-stack de análisis de inversiones en ETFs que combina datos de mercado en tiempo real, análisis de noticias con IA (LLM) y predicciones de tendencia con Machine Learning.

Proyecto de doble propósito:
- **Uso personal real**: monitorear posiciones propias (VGT, QQQ, VOO, NVDA) con señales de compra/venta y noticias relevantes.
- **Portafolio profesional**: demostrar un stack financiero completo (Java/Spring Boot, Python/IA, React/Next.js, PostgreSQL, Power BI) para roles de Full-Stack Developer / Data Analyst en el sector financiero.

## Arquitectura

```
                     ┌──────────────────────┐
                     │       Angular        │  (Fase 3)
                     │  Dashboard / Señales  │
                     └──────────┬───────────┘
                                │ REST (JWT)
                     ┌──────────▼───────────┐        ┌──────────────────────┐
                     │  Spring Boot Backend │───────▶│  Yahoo Finance API   │
                     │  (Java 17)           │        │  (precios en tiempo  │
                     │  controller/service/ │        │   real e históricos) │
                     │  repository          │        └──────────────────────┘
                     └──────────┬───────────┘
                                │ HTTP                ┌──────────────────────┐
                                ├─────────────────────▶  Python microservicio │  (Fase 2)
                                │                      │  FastAPI + NewsAPI +  │
                                │                      │  Claude (sentimiento) │
                                │                      └──────────────────────┘
                     ┌──────────▼───────────┐
                     │      PostgreSQL       │◀──────── Power BI (Fase 5)
                     │  users / etfs /       │          Dashboard ejecutivo
                     │  price_history /      │
                     │  portfolio_positions /│
                     │  alerts               │
                     └───────────────────────┘
```

## Fases de desarrollo

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Backend Spring Boot + modelo PostgreSQL + precios en tiempo real (Yahoo Finance) + JWT + Swagger | ✅ Este repo |
| 2 | Microservicio Python (FastAPI) + NewsAPI + análisis de sentimiento con Claude | ✅ `ai-service/` |
| 3 | Frontend Angular (gráficos de vela, señal de recomendación, portfolio, alertas, tiempo real) | ✅ `frontend/` |
| 4 | Modelo predictivo de tendencia a 1 mes con scikit-learn | ✅ `ai-service/` |
| 5 | Dashboard ejecutivo en Power BI conectado a PostgreSQL | ⏳ |

## Fase 1 — Backend Spring Boot (este repo)

### Stack

- Java 17 + Spring Boot 3.3
- Spring Web, Spring Data JPA, Spring Security (JWT stateless), Bean Validation
- PostgreSQL 16 + Flyway (migraciones versionadas)
- WebClient para consumir la API pública de Yahoo Finance (misma fuente que usa `yfinance`)
- springdoc-openapi (Swagger UI)
- Lombok

### Funcionalidad incluida en Fase 1

- Registro / login con JWT (`/api/auth/register`, `/api/auth/login`)
- Catálogo de ETFs, pre-cargado con VGT, QQQ, VOO y NVDA (`/api/etfs`)
- Cotización en tiempo real + histórico desde Yahoo Finance (`/api/market/quote/{symbol}`, `/api/market/history/{symbol}`)
- Señal técnica básica (SMA5 vs SMA20) como placeholder de la recomendación Comprar/Mantener/Esperar — se combinará con sentimiento de noticias (Fase 2) y con el modelo scikit-learn (Fase 4)
- Portfolio personal con valorización en tiempo real y rendimiento por posición (`/api/portfolio`)
- Alertas configurables por precio o cambio porcentual, con un scheduler que las evalúa contra el precio en vivo (`/api/alerts`)
- Caché de histórico diario en `price_history` (`POST /api/market/cache/{symbol}`), para que Power BI y el modelo de ML no dependan de Yahoo Finance en vivo

### Modelo de datos (PostgreSQL)

Ver [`backend/src/main/resources/db/migration/V1__init_schema.sql`](backend/src/main/resources/db/migration/V1__init_schema.sql).

- `users` — cuentas con rol (USER/ADMIN)
- `etfs` — catálogo de ETFs seguidos
- `price_history` — histórico diario OHLCV por ETF
- `portfolio_positions` — posiciones del portfolio personal
- `alerts` — alertas de precio / cambio porcentual, con estado y fecha de disparo

### Cómo correrlo localmente

**1. Levantar PostgreSQL con Docker:**

```bash
docker compose up -d
```

**2. Configurar variables de entorno** (copia `backend/.env.example` y ajusta si es necesario; los valores por defecto ya coinciden con `docker-compose.yml`).

**3. Ejecutar el backend:**

```bash
cd backend
./mvnw spring-boot:run
```

Flyway crea el esquema y siembra los 4 ETFs automáticamente al arrancar.

**4. Explorar la API:**

- Swagger UI: http://localhost:8080/swagger-ui.html
- OpenAPI JSON: http://localhost:8080/v3/api-docs

**5. Flujo típico:**

```bash
# Registrarse
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"cesar","email":"cesar@example.com","password":"changeme123"}'

# Login -> guarda el token de la respuesta
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"cesar","password":"changeme123"}'

# Cotización en tiempo real (requiere JWT)
curl http://localhost:8080/api/market/quote/QQQ \
  -H "Authorization: Bearer <TOKEN>"

# Agregar una posición real de eToro
curl -X POST http://localhost:8080/api/portfolio \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"symbol":"NVDA","quantity":10,"avgBuyPrice":120.50,"purchaseDate":"2025-01-15"}'
```

### Estructura de carpetas

```
backend/
  src/main/java/com/cesarx/analytics/
    config/         # Security, WebClient, OpenAPI
    security/       # JWT util, filtro, UserDetails
    controller/     # Endpoints REST
    service/        # Lógica de negocio
    repository/      # Spring Data JPA
    model/entity/   # Entidades JPA
    dto/            # Request/response DTOs por dominio
    exception/      # Excepciones + manejador global
  src/main/resources/
    application.yml
    db/migration/   # Migraciones Flyway
```

## Fase 3 — Frontend Angular (`frontend/`)

### Stack

- Angular 20 (componentes standalone, signals, control flow `@if/@for`)
- `lightweight-charts` (TradingView) para el gráfico de velas con volumen
- `HttpClient` + interceptor JWT + guard de rutas
- Proxy de desarrollo (`proxy.conf.json`) hacia el backend en `:8080` — sin problemas de CORS

### Funcionalidad

- **Login / registro** contra `/api/auth` con sesión JWT persistida en `localStorage`
- **Tarjetas de cotización** en vivo por ETF: precio, variación diaria, rango del día y señal **Comprar / Mantener / Esperar**
- **Gráfico de velas + volumen** del ETF seleccionado, con rangos 1mo / 3mo / 6mo / 1y / 5y
- **Portfolio personal**: totales (valor de mercado, invertido, G/P), tabla de posiciones con rendimiento en vivo, alta y baja de posiciones
- **Alertas**: crear por precio o % de cambio, pausar/activar, ver disparadas

### Cómo correrlo

```bash
cd frontend
npm install
npm start        # sirve en http://localhost:4200 con proxy a :8080
```

Requiere el backend corriendo (`cd backend && ./mvnw spring-boot:run`) y PostgreSQL levantado (`docker compose up -d`).

## Fases 2 y 4 — Microservicio de IA (`ai-service/`)

### Stack

- Python 3 + FastAPI + Uvicorn
- `yfinance` para histórico de precios (5 años)
- `scikit-learn` (Ridge regression) para la predicción de tendencia a 1 mes
- NewsAPI para noticias recientes por ETF
- SDK `anthropic` — Claude clasifica el sentimiento de cada noticia y escribe un outlook en español

### Endpoints

- `GET /health` — estado del servicio y qué API keys están configuradas
- `GET /predict/{symbol}` — predicción a ~30 días: precio esperado, retorno %, dirección (UP/DOWN/SIDEWAYS) y confianza basada en R² out-of-sample
- `GET /news/{symbol}` — noticias de los últimos 7 días con sentimiento por artículo (positivo/negativo/neutral) + outlook general

El backend Java los expone vía proxy en `/api/ai/predict/{symbol}` y `/api/ai/news/{symbol}` (protegidos con JWT).

### Cómo correrlo

```bash
cd ai-service
python -m venv venv
venv\Scripts\pip install -r requirements.txt   # Windows
copy .env.example .env                          # y rellena NEWS_API_KEY y ANTHROPIC_API_KEY
venv\Scripts\python -m uvicorn app.main:app --port 8000
```

La predicción funciona sin API keys. El análisis de noticias requiere:
- `NEWS_API_KEY` — gratis en https://newsapi.org (100 requests/día)
- `ANTHROPIC_API_KEY` — https://platform.claude.com

### Tiempo real

El frontend refresca todas las cotizaciones cada 20 segundos vía `GET /api/market/quotes` (una llamada batch ligera por tick). El header muestra un indicador verde con la hora de la última actualización.

## Flujo de Git sugerido

- `main` — versión estable y desplegable
- `develop` — integración de features antes de pasar a `main`
- `feature/<nombre>` — una rama por funcionalidad (p. ej. `feature/news-sentiment-service`)

## Próximos pasos

Fase 2: microservicio Python (FastAPI) que consuma NewsAPI y clasifique el sentimiento de cada noticia por ETF usando la API de Claude, expuesto vía HTTP para que el backend Java lo consuma.
