# CesarX Analytics — ETF Intelligence Platform

Plataforma full-stack para seguir 10 activos (ETFs y NVDA) con precios de mercado, noticias del día y proyecciones validadas con ciencia de datos a cinco plazos: 1 semana, 15 días, 1 mes, 6 meses y 1 año.

Proyecto de doble propósito:
- **Uso personal**: monitorear posiciones propias con señales técnicas y noticias relevantes.
- **Portafolio profesional**: demostrar un stack completo (Java/Spring Boot, Python/IA, Angular, PostgreSQL) para roles de Full-Stack Developer / Data Analyst.

## Estado actual (noviembre de 2026)

| Funciona en producción | Limitación conocida |
|---|---|
| Registro, inicio de sesión con usuario y contraseña, portfolio y alertas | El inicio de sesión no acepta el correo, solo el nombre de usuario |
| Precios reales de Yahoo Finance | Yahoo no garantiza tiempo real; ver [Frescura de los datos](#frescura-de-los-datos) |
| Proyecciones a cinco plazos con explicación | Ningún modelo superó de forma fiable a la media histórica; la confianza suele ser baja |
| Noticias de Yahoo Finance | Sin `ANTHROPIC_API_KEY` el tono se estima por palabras clave |
| Recuperación de contraseña por enlace | Sin `BREVO_API_KEY` y `MAIL_FROM` no salen correos; ver [Recuperar la contraseña](#recuperar-la-contraseña) |

Ningún método puede dar el precio futuro exacto: la app muestra lo más probable, su margen de error y de dónde sale cada cifra.

## 🔗 Demo en vivo

- **App:** https://cesarespa.github.io/CesarX-Analytics/ → botón **Probar la demo sin registrarme**
- **API (Swagger):** https://cesarx-analytics.onrender.com/swagger-ui/index.html

La demo no necesita cuenta ni servidor: `frontend/src/app/core/demo-api.ts` responde los mismos contratos que el backend, con **precios, noticias y predicciones simulados** y marcados como tales en pantalla. Crear una cuenta usa la API real con datos de Yahoo Finance.

> El backend y la IA corren en el plan gratuito de Render y se duermen tras 15 min sin tráfico. La pantalla de ingreso despierta la API y esta espera a que la IA arranque, así que la primera carga puede tardar más de un minuto.

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
| 3 | Frontend Angular (gráficos de vela, señal técnica, proyección, portfolio, alertas) | ✅ `frontend/` |
| 4 | Proyección validada a cinco plazos con scikit-learn | ✅ `ai-service/` |
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
- Recuperación de contraseña (`/api/auth/forgot-password`, `/api/auth/reset-password`)
- Catálogo de 10 activos: VGT, QQQ, VOO, NVDA, SPY, VTI, DIA, IWM, SMH y GLD (`/api/etfs`)
- Cotización e histórico desde Yahoo Finance (`/api/market/quote/{symbol}`, `/api/market/history/{symbol}`)
- Señal técnica básica (SMA5 vs SMA20), mostrada como alza, neutral o baja
- Portfolio personal con valorización al último precio y rendimiento por posición (`/api/portfolio`)
- Alertas configurables por precio o cambio porcentual, con un scheduler que las evalúa contra el precio en vivo (`/api/alerts`)
- Caché de histórico diario en `price_history` (`POST /api/market/cache/{symbol}`), para que Power BI y el modelo de ML no dependan de Yahoo Finance en vivo

### Modelo de datos (PostgreSQL)

Ver [`backend/src/main/resources/db/migration/V1__init_schema.sql`](backend/src/main/resources/db/migration/V1__init_schema.sql).

- `users` — cuentas con rol (USER/ADMIN)
- `etfs` — catálogo de ETFs seguidos
- `price_history` — histórico diario OHLCV por ETF
- `portfolio_positions` — posiciones del portfolio personal
- `alerts` — alertas de precio / cambio porcentual, con estado y fecha de disparo
- `password_reset_tokens` — enlaces de recuperación; solo guarda el hash del enlace

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

Flyway crea el esquema y siembra el catálogo de activos al arrancar.

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

- **Login / registro / recuperación de contraseña** contra `/api/auth`, con sesión JWT persistida en `localStorage`
- **Modo demo** sin cuenta ni servidor, con datos simulados y marcados como tales
- **Tarjetas de cotización** por activo: precio, variación diaria y señal **alza / neutral / baja**
- **Gráfico de velas + volumen** con medias de 20 y 50 días, lectura OHLC al pasar el cursor y rangos 1D / 5D / 1M / 3M / 6M / 1A / 5A
- **Selector "Proyectar a"**: 1 semana, 15 días, 1 mes, 6 meses o 1 año. La gráfica dibuja la trayectoria esperada y una banda con el rango del 80%, y ajusta el historial visible al plazo
- **"Por qué se podría mover así"**: explicación con el modelo, el historial, situaciones parecidas, la tendencia, el riesgo y los titulares del día, cada motivo marcado a favor, en contra o neutral
- **Lectura del historial** y **noticias actuales** con su tono
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

1. **Validación walk-forward** de 5 bloques con una purga igual al plazo entre entrenamiento y prueba, porque los retornos de ventanas consecutivas se solapan.
2. **Elección y evaluación separadas**: el modelo se elige en los primeros 3 bloques y se mide en los 2 últimos, que no participan en la elección.
3. **Referencia obligatoria**: si ningún modelo supera a la media histórica en los bloques finales, se usa la media. El R² es out-of-sample contra esa referencia.
4. **Significancia**: bootstrap por bloques al 95%. Sin ventaja significativa, la confianza siempre es baja.
5. **Incertidumbre**: intervalo conformal del 80% calibrado con errores fuera de muestra y comprobado en los bloques finales.
6. **Noticias aparte**: no entran al modelo porque no hay historial de titulares con el que validarlas.

**Plazo inicial de una semana.** Se midieron 3, 5, 10, 15 y 21 sesiones en los 10 activos (mediana, 8 de noviembre de 2026). La app abre en 5 sesiones: es el plazo útil con menos margen.

| Sesiones | Ancho del rango 80% | Error típico | Modelos que superan la media | Con ventaja fiable |
|---|---|---|---|---|
| 3 | 5,1 puntos | 1,62% | 3 de 10 | 0 |
| **5** | **6,6 puntos** | **2,10%** | **1 de 10** | **0** |
| 10 | 9,4 puntos | 2,88% | 1 de 10 | 0 |
| 15 | 11,9 puntos | 3,55% | 4 de 10 | 0 |
| 21 | 13,9 puntos | 4,32% | 4 de 10 | 0 |

Acortar el plazo reduce el margen porque el precio tiene menos tiempo para moverse, no porque el modelo acierte más: en ningún horizonte hubo ventaja estadísticamente fiable. La app expone esa incertidumbre en lugar de ocultarla.

**Plazos disponibles.** El usuario elige 1 semana, 15 días, 1 mes, 6 meses o 1 año. Hasta 1 mes se ejecuta la validación completa. A 6 meses y 1 año, 10 años de datos dejan 3 y 1 periodos sin solapar: no alcanza para validar un modelo, así que la cifra es el promedio histórico, el rango resume todas las ventanas de ese plazo y la app lo declara. Cada proyección incluye una explicación generada con sus propias cifras: modelo, historial, situaciones parecidas, gráfica, riesgo y noticias.

### Endpoints

- `GET /health` — estado del servicio y qué API keys están configuradas
- `GET /predict/{symbol}?horizon=1w|15d|1m|6m|1y` — proyección con rango, comparación de modelos, lectura del historial, trayectoria para la gráfica y explicación
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

Sin Brevo, quien administra la base puede generar el enlace desde el editor SQL. La persona define su contraseña en la página, sin que nadie más la vea, y entra con su **nombre de usuario**:

```sql
with nuevo as (
  select id as user_id,
         replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') as token
  from cesarx.users
  where lower(email) = lower('correo@ejemplo.com')
  limit 1
), guardado as (
  insert into cesarx.password_reset_tokens (user_id, token_hash, expires_at)
  select user_id, encode(sha256(convert_to(token, 'UTF8')), 'hex'), now() + interval '30 minutes'
  from nuevo
)
select 'https://cesarespa.github.io/CesarX-Analytics/reset-password?token=' || token as enlace
from nuevo;
```

Para ver las cuentas registradas: `select id, username, email, created_at from cesarx.users;`. La columna `password_hash` no permite recuperar ninguna contraseña.

### Frescura de los datos

| Dato | Actualización | Retraso máximo que agrega la app |
|---|---|---|
| Precio de las tarjetas | La web consulta cada 20 s y la API guarda el dato 30 s | Unos 50 s |
| Velas de 1D y 5D | Cada 5 min | Unos 5 min |
| Noticias | Caché de 3 horas | 3 horas |
| Proyecciones | Caché de 6 horas, con cierres diarios | 6 horas, más la sesión en curso |

A esto se suma el retraso propio de Yahoo Finance, que no es una fuente garantizada en tiempo real. Si Yahoo falla, la API sigue sirviendo el último precio conocido hasta por una hora. La app sirve para seguir el mercado, no para operar al segundo.

## ✅ Pruebas

| Módulo | Qué cubren | Comando |
|---|---|---|
| Backend (45, JUnit 5 + MockMvc) | Señal SMA5/SMA20, variación diaria, caché y fallos de Yahoo, JWT (expirado, alterado, otra clave, secreto ausente), 401 en rutas protegidas, CORS, alertas, totales del portfolio, registro, recuperación de contraseña, espera a que la IA despierte | `cd backend && ./mvnw test` |
| IA (39, pytest) | Sin fuga de datos futuros, purga del walk-forward, significancia, intervalos, los cinco plazos, explicación con y sin noticias, historial insuficiente | `cd ai-service && python -m pytest` |

GitHub Actions ejecuta ambas suites y compila el frontend en cada push (`.github/workflows/ci.yml`).

## 🚀 Despliegue

| Pieza | Servicio | Configuración |
|---|---|---|
| Frontend | GitHub Pages | `.github/workflows/deploy-frontend.yml`. En el repo: *Settings → Pages → Source: GitHub Actions* |
| Backend e IA | Render (Docker) | `render.yaml` define los dos servicios |
| Base de datos | PostgreSQL (Supabase, *Session pooler*) | Flyway crea las tablas en el esquema `DB_SCHEMA`, así que se puede compartir la base con otro proyecto |

Variables del backend: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE=require`, `DB_SCHEMA`, `JWT_SECRET`, `AI_SERVICE_URL`, `ALLOWED_ORIGINS`. Para los correos de recuperación: `BREVO_API_KEY`, `MAIL_FROM` y `RESET_PAGE_URL`. Ver [`backend/.env.example`](backend/.env.example).

El microservicio de IA proyecta y trae noticias sin claves. Opcionales: `NEWS_API_KEY` para otra fuente de titulares y `ANTHROPIC_API_KEY` para analizar su tono con Claude.

**Publicar cambios.** Un push a `main` con cambios en `frontend/**` publica la web en GitHub Pages. Los servicios de Render se actualizan con *Manual Deploy → Deploy latest commit*. Si la web depende de cambios en la API o la IA, despliega primero esos servicios y luego publica la web.

## Decisiones técnicas

- **Caché de 30 s por consulta a Yahoo:** el refresco de todos los usuarios comparte las mismas llamadas para no provocar errores 429; si Yahoo falla se sirve el último dato conocido, hasta una hora.
- **Sin claves por defecto:** sin `JWT_SECRET`, o con el valor de ejemplo, se firma con una clave aleatoria en memoria.
- **Límite de peticiones por IP** en registro, recuperación de contraseña y endpoints de IA, que consumen cuotas externas.
- **JVM ajustada a 512 MB** para el plan gratuito de Render.
- **Espera al arranque de la IA:** ante errores de la plataforma mientras el servicio despierta, la API reintenta cada 8 s, hasta 8 veces. Los errores que reporta el propio servicio no se reintentan.
- **Noticias fuera del modelo:** se citan en la explicación, pero no cambian la cifra proyectada porque no hay historial con el que validar su efecto.
- **Plazos largos sin modelo:** a 6 meses y 1 año se usa el promedio histórico y la app lo declara, en lugar de presentar un modelo que no se pudo validar.

> Proyecto educativo. Las señales y predicciones son modelos estadísticos simples y no constituyen asesoría financiera.
