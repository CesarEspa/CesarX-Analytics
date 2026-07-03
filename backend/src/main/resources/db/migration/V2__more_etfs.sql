-- Broaden the tracked catalog: S&P 500, total market, Dow, small caps, semis and gold.

INSERT INTO etfs (symbol, name, sector, exchange, currency) VALUES
    ('SPY', 'SPDR S&P 500 ETF Trust',            'Broad Market',   'NYSEARCA', 'USD'),
    ('VTI', 'Vanguard Total Stock Market ETF',   'Broad Market',   'NYSEARCA', 'USD'),
    ('DIA', 'SPDR Dow Jones Industrial Average', 'Broad Market',   'NYSEARCA', 'USD'),
    ('IWM', 'iShares Russell 2000 ETF',          'Small Cap',      'NYSEARCA', 'USD'),
    ('SMH', 'VanEck Semiconductor ETF',          'Semiconductors', 'NASDAQ',   'USD'),
    ('GLD', 'SPDR Gold Shares',                  'Commodities',    'NYSEARCA', 'USD')
ON CONFLICT (symbol) DO NOTHING;
