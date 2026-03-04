-- Users table (email auth + SAML)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  saml_id VARCHAR(255),
  display_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_saml_id ON users(saml_id) WHERE saml_id IS NOT NULL;

-- User preferences (theme, etc.)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(50) DEFAULT 'system',
  font_size VARCHAR(50) DEFAULT 'medium',
  font_style VARCHAR(100) DEFAULT 'default',
  icon_pack VARCHAR(100) DEFAULT 'default',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
