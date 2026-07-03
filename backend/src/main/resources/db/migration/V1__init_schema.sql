-- CesarX Analytics - ETF Intelligence Platform
-- Phase 1 schema: users, etfs, price history, personal portfolio, alerts

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(120) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE etfs (
    id              BIGSERIAL PRIMARY KEY,
    symbol          VARCHAR(15)  NOT NULL UNIQUE,
    name            VARCHAR(150) NOT NULL,
    sector          VARCHAR(100),
    exchange        VARCHAR(50),
    currency        VARCHAR(10)  NOT NULL DEFAULT 'USD',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE price_history (
    id              BIGSERIAL PRIMARY KEY,
    etf_id          BIGINT NOT NULL REFERENCES etfs(id) ON DELETE CASCADE,
    price_date      DATE   NOT NULL,
    open_price      NUMERIC(14, 4),
    high_price      NUMERIC(14, 4),
    low_price       NUMERIC(14, 4),
    close_price     NUMERIC(14, 4) NOT NULL,
    volume          BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_price_history_etf_date UNIQUE (etf_id, price_date)
);

CREATE TABLE portfolio_positions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    etf_id          BIGINT NOT NULL REFERENCES etfs(id) ON DELETE CASCADE,
    quantity        NUMERIC(18, 6) NOT NULL,
    avg_buy_price   NUMERIC(14, 4) NOT NULL,
    purchase_date   DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_portfolio_user_etf_date UNIQUE (user_id, etf_id, purchase_date)
);

CREATE TABLE alerts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    etf_id          BIGINT NOT NULL REFERENCES etfs(id) ON DELETE CASCADE,
    alert_type      VARCHAR(30) NOT NULL,
    target_value    NUMERIC(14, 4) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    triggered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_etf_date ON price_history (etf_id, price_date DESC);
CREATE INDEX idx_portfolio_user ON portfolio_positions (user_id);
CREATE INDEX idx_alerts_user_active ON alerts (user_id, is_active);

-- Seed the ETFs from the personal eToro portfolio (VGT, QQQ, VOO, NVDA)
INSERT INTO etfs (symbol, name, sector, exchange, currency) VALUES
    ('VGT',  'Vanguard Information Technology ETF', 'Technology', 'NYSEARCA', 'USD'),
    ('QQQ',  'Invesco QQQ Trust',                    'Technology', 'NASDAQ',   'USD'),
    ('VOO',  'Vanguard S&P 500 ETF',                 'Broad Market', 'NYSEARCA', 'USD'),
    ('NVDA', 'NVIDIA Corporation',                   'Semiconductors', 'NASDAQ', 'USD');
