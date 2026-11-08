# CesarX Analytics — ETF Intelligence Platform

Plataforma full-stack de análisis de inversiones en ETFs que combina datos de mercado en tiempo real, análisis de noticias con IA (LLM) y predicciones de tendencia con Machine Learning.

Proyecto de doble propósito:
- **Uso personal real**: monitorear posiciones propias (VGT, QQQ, VOO, NVDA) con señales de compra/venta y noticias relevantes.
- **Portafolio profesional**: demostrar un stack financiero completo (Java/Spring Boot, Python/IA, Angular, PostgreSQL, Power BI) para roles de Full-Stack Developer / Data Analyst en el sector financiero.

## 🔗 Demo en vivo

- **App:** https://cesarespa.github.io/CesarX-Analytics/ → botón **Probar la demo sin registrarme**
- **API (Swagger):** https://cesarx-analytics.onrender.com/swagger-ui/index.html

La demo no necesita cuenta ni servidor: `frontend/src/app/core/demo-api.ts` responde los mismos contratos que el backend, con **precios, noticias y predicciones simulados** y marcados como tales en pantalla. Crear una cuenta usa la API real con datos de Yahoo Finance.

> El backend corre en el plan gratuito de Render y se duerme tras 15 min sin tráfico. La pantalla de ingreso lo despierta en segundo plano y muestra su estado.

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
- `yfinance` para precios, volumen, VIX y bono a 10 años (10 años de historia)
- `scikit-learn`: Ridge, Random Forest, Gradient Boosting y ensamble, comparados contra la media histórica
- Noticias de Yahoo Finance sin clave, o NewsAPI si hay clave
- SDK `anthropic` — Claude clasifica el sentimiento si hay clave; sin ella, un conteo transparente de palabras clave

### Metodología de la predicción

1. **Validación walk-forward** de 5 bloques con purga de 21 sesiones entre entrenamiento y prueba, porque los retornos mensuales se solapan.
2. **Elección y evaluación separadas**: el modelo se elige en los primeros 3 bloques y se mide en los 2 últimos, que no participan en la elección.
3. **Referencia obligatoria**: si ningún modelo supera a la media histórica en los bloques finales, se usa la media. El R² es out-of-sample contra esa referencia.
4. **Significancia**: bootstrap por bloques al 95%. Sin ventaja significativa, la confianza siempre es baja.
5. **Incertidumbre**: intervalo conformal del 80% calibrado con errores fuera de muestra y comprobado en los bloques finales.
6. **Noticias aparte**: no entran al modelo porque no hay historial de titulares con el que validarlas.

Resultado medido el 8 de noviembre de 2026 en los 10 activos: 4 superaron a la media histórica (R² entre 0,008 y 0,056) y ninguno con ventaja estadísticamente significativa. La cobertura real del intervalo estuvo entre 58% y 94%. Es lo esperable a un mes vista: la app expone esa incertidumbre en lugar de ocultarla.

### Endpoints

- `GET /health` — estado del servicio y qué API keys están configuradas
- `GET /predict/{symbol}` — proyección a ~30 días con rango, comparación de modelos, lectura del historial y trayectoria para la gráfica
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

La predicción y las noticias funcionan sin API keys. Opcionales:
- `NEWS_API_KEY` — otra fuente de titulares, https://newsapi.org
- `ANTHROPIC_API_KEY` — análisis de sentimiento con Claude, https://platform.claude.com

### Recuperar la contraseña

Las contraseñas se guardan con BCrypt y no se pueden consultar, solo reemplazar. El backend envía un enlace de un solo uso (30 minutos, solo se guarda su hash) mediante la API HTTPS de Brevo, porque el plan gratuito de Render bloquea SMTP. Requiere `BREVO_API_KEY` y `MAIL_FROM` (un remitente verificado en Brevo).

### Tiempo real

El frontend refresca todas las cotizaciones cada 20 segundos vía `GET /api/market/quotes` (una llamada batch ligera por tick). El header muestra un indicador verde con la hora de la última actualización.

## ✅ Pruebas

| Módulo | Qué cubren | Comando |
|---|---|---|
| Backend (36, JUnit 5 + MockMvc) | Señal SMA5/SMA20, variación diaria, caché y fallos de Yahoo, JWT (expirado, alterado, otra clave, secreto ausente), 401 en rutas protegidas, CORS, alertas, totales del portfolio, registro | `cd backend && ./mvnw test` |
| IA (10, pytest) | Sin fuga de datos futuros en las variables, RSI acotado, umbrales de dirección, historial insuficiente | `cd ai-service && python -m pytest` |

GitHub Actions ejecuta ambas suites y compila el frontend en cada push (`.github/workflows/ci.yml`).

## 🚀 Despliegue

| Pieza | Servicio | Configuración |
|---|---|---|
| Frontend | GitHub Pages | `.github/workflows/deploy-frontend.yml`. En el repo: *Settings → Pages → Source: GitHub Actions* |
| Backend e IA | Render (Docker) | `render.yaml` define los dos servicios |
| Base de datos | PostgreSQL (Supabase, *Session pooler*) | Flyway crea las tablas en el esquema `DB_SCHEMA`, así que se puede compartir la base con otro proyecto |

Variables del backend: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE=require`, `DB_SCHEMA`, `JWT_SECRET`, `AI_SERVICE_URL`, `ALLOWED_ORIGINS`. Ver [`backend/.env.example`](backend/.env.example).

El microservicio de IA predice sin claves. Para noticias añade `NEWS_API_KEY` y, para clasificar su sentimiento, `ANTHROPIC_API_KEY`.

## Decisiones técnicas

- **Caché de 30 s por consulta a Yahoo:** el refresco de todos los usuarios comparte las mismas llamadas para no provocar errores 429; si Yahoo falla se sirve el último dato conocido, hasta una hora.
- **Sin claves por defecto:** sin `JWT_SECRET`, o con el valor de ejemplo, se firma con una clave aleatoria en memoria.
- **Límite de peticiones por IP** en registro y en los endpoints de IA, que consumen cuotas externas.
- **JVM ajustada a 512 MB** para el plan gratuito de Render.

> Proyecto educativo. Las señales y predicciones son modelos estadísticos simples y no constituyen asesoría financiera.
