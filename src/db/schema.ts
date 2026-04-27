import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum, index, boolean, primaryKey, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const dealStatusEnum = pgEnum('deal_status', ['draft', 'live', 'paused', 'closed']);
export const eoiStatusEnum = pgEnum('eoi_status', ['sent', 'approved', 'declined', 'expired']);
export const tokenTransactionTypeEnum = pgEnum('token_transaction_type', ['credit', 'debit']);

// 1. USERS
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  phone: text('phone'),
  isPhoneVerified: boolean('is_phone_verified').default(false),
  profileCompletedOnce: boolean('profile_completed_once').default(false),
  profileCompletion: integer('profile_completion').default(0),
  tokens: integer('tokens').default(0),
  
  // Professional Profile Fields (PRD-aligned)
  firmName: text('firm_name'),
  role: text('role'),
  customRole: text('custom_role'),
  category: text('category').array(),
  customCategory: text('custom_category'),
  baseLocation: text('base_location'),
  baseCity: text('base_city'),
  baseCountry: text('base_country'),
  geographies: text('geographies').array(),
  crossBorder: boolean('cross_border').default(false),
  corridors: text('corridors').array(),
  sectors: text('sectors').array(),
  intent: text('intent').array(),
  expertiseDescription: text('expertise_description'),
  activeMandates: text('active_mandates').array(),
  prioritySectors: text('priority_sectors').array(),
  coAdvisory: boolean('co_advisory').default(false),
  collaborationModel: text('collaboration_model').array(),
  profileAttachmentUrl: text('profile_attachment_url'),
  additionalInfo: text('additional_info'),
  
  
  // OTP Verification
  otpCode: text('otp_code'),
  otpExpires: timestamp('otp_expires'),
  otpAttempts: integer('otp_attempts').default(0),

  source: text('source').default('web'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Auth.js Tables
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId),
    userIdIdx: index('accounts_user_id_idx').on(account.userId),
  })
);

export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (session) => ({
    userIdIdx: index('sessions_user_id_idx').on(session.userId),
  })
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey(vt.identifier, vt.token),
  })
);

// 2. DEALS
export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  sector: text('sector'),
  region: text('region'),
  size: text('size'),
  status: dealStatusEnum('status').default('live').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. MATCHES
export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  matchData: jsonb('match_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. EOIs (Expressions of Interest)
export const eois = pgTable('eois', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  matchId: uuid('match_id').references(() => matches.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: eoiStatusEnum('status').default('sent').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. TOKEN TRANSACTIONS (Ledger)
export const tokenTransactions = pgTable('token_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // 'credit', 'debit', 'purchase'
  action: text('action').notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});



// 7. NOTIFICATIONS
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  isRead: text('is_read').default('false').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. MANDATES
export const mandates = pgTable('mandates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rawText: text('raw_text').notNull(),
  normalisedText: text('normalised_text'),
  intent: text('intent'), // BUY_SIDE, SELL_SIDE, INVESTMENT
  sectors: text('sectors').array(),
  geographies: text('geographies').array(),
  dealSizeMinCr: numeric('deal_size_min_cr'),
  dealSizeMaxCr: numeric('deal_size_max_cr'),
  revenueMinCr: numeric('revenue_min_cr'),
  revenueMaxCr: numeric('revenue_max_cr'),
  dealStructure: text('deal_structure'), // Asset, Share, Majority
  specialConditions: text('special_conditions').array(),
  fraudFlags: text('fraud_flags').array(),
  urgency: text('urgency'), // Low, Medium, High
  buyerType: text('buyer_type'), // Strategic, Financial
  status: text('status').default('ACTIVE').notNull(),
  source: text('source').default('WEB').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. CHAT SESSIONS
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').default('New Deal Intake'),
  sessionData: jsonb('session_data').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. CHAT MESSAGES
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(), // 'user', 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  deals: many(deals),
  tokenTransactions: many(tokenTransactions),
  notifications: many(notifications),
  mandates: many(mandates),
  chatSessions: many(chatSessions),
  sentEois: many(eois, { relationName: 'sender' }),
  receivedEois: many(eois, { relationName: 'receiver' }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  user: one(users, { fields: [deals.userId], references: [users.id] }),
  matches: many(matches),
  eois: many(eois),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  deal: one(deals, { fields: [matches.dealId], references: [deals.id] }),
}));

export const eoisRelations = relations(eois, ({ one }) => ({
  deal: one(deals, { fields: [eois.dealId], references: [deals.id] }),
  match: one(matches, { fields: [eois.matchId], references: [matches.id] }),
  sender: one(users, { fields: [eois.senderId], references: [users.id], relationName: 'sender' }),
  receiver: one(users, { fields: [eois.receiverId], references: [users.id], relationName: 'receiver' }),
}));

export const tokenTransactionsRelations = relations(tokenTransactions, ({ one }) => ({
  user: one(users, { fields: [tokenTransactions.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const mandatesRelations = relations(mandates, ({ one }) => ({
  user: one(users, { fields: [mandates.userId], references: [users.id] }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, { fields: [chatSessions.userId], references: [users.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chat: one(chatSessions, { fields: [chatMessages.chatId], references: [chatSessions.id] }),
}));
