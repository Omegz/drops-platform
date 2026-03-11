export const d1SchemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    active_role TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS magic_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    redirect_path TEXT,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number TEXT,
    vehicle_label TEXT NOT NULL,
    availability TEXT NOT NULL,
    last_known_latitude REAL,
    last_known_longitude REAL,
    last_location_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS driver_devices (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    expo_push_token TEXT,
    endpoint TEXT,
    subscription_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS driver_accounts (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    user_id TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS driver_invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    driver_name TEXT NOT NULL,
    vehicle_label TEXT NOT NULL,
    invited_by_user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    approved_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone_number TEXT,
    pickup_json TEXT NOT NULL,
    dropoff_json TEXT NOT NULL,
    notes TEXT,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_driver_id TEXT,
    tracking_token TEXT NOT NULL UNIQUE,
    customer_webhook_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_offers (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    driver_id TEXT NOT NULL,
    status TEXT NOT NULL,
    score REAL NOT NULL,
    pickup_distance_km REAL NOT NULL,
    pickup_json TEXT NOT NULL,
    dropoff_json TEXT NOT NULL,
    offered_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_events (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    happened_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS customer_order_owners (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links (email, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_drivers_availability ON drivers (availability)`,
  `CREATE INDEX IF NOT EXISTS idx_driver_accounts_user_id ON driver_accounts (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_driver_invitations_status ON driver_invitations (status, email)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON orders (tracking_token)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON orders (assigned_driver_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_order_offers_order_driver ON order_offers (order_id, driver_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events (order_id, happened_at)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_order_owners_user_id ON customer_order_owners (user_id, created_at)`,
];

export const seedDriverStatements = [
  {
    sql: `INSERT OR IGNORE INTO driver_accounts (
      id, driver_id, email, user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    params: [
      "drvacct_demo_01",
      "driver_demo_01",
      "driver_demo_01@drops.app",
      null,
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO driver_accounts (
      id, driver_id, email, user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    params: [
      "drvacct_demo_02",
      "driver_demo_02",
      "driver_demo_02@drops.app",
      null,
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO driver_accounts (
      id, driver_id, email, user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    params: [
      "drvacct_demo_03",
      "driver_demo_03",
      "driver_demo_03@drops.app",
      null,
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO drivers (
      id, name, phone_number, vehicle_label, availability,
      last_known_latitude, last_known_longitude, last_location_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      "driver_demo_01",
      "Mikael Jensen",
      "+45 12 34 56 78",
      "Van 12",
      "online",
      55.6761,
      12.5683,
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO drivers (
      id, name, phone_number, vehicle_label, availability,
      last_known_latitude, last_known_longitude, last_location_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      "driver_demo_02",
      "Sara Nielsen",
      "+45 21 43 65 87",
      "Bike 4",
      "online",
      55.6852,
      12.5736,
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO drivers (
      id, name, phone_number, vehicle_label, availability,
      last_known_latitude, last_known_longitude, last_location_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      "driver_demo_03",
      "Jonas Holm",
      "+45 98 76 54 32",
      "Car 9",
      "offline",
      55.6725,
      12.5551,
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
      "2026-03-11T15:00:00.000Z",
    ],
  },
];
