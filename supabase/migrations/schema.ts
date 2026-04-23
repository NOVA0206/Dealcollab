import { pgTable, index, foreignKey, uuid, text, integer, timestamp, jsonb, unique, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const dealStatus = pgEnum("deal_status", ['draft', 'live', 'paused', 'closed'])
export const eoiStatus = pgEnum("eoi_status", ['sent', 'approved', 'declined', 'expired'])
export const tokenTransactionType = pgEnum("token_transaction_type", ['credit', 'debit'])


export const accounts = pgTable("accounts", {
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	provider: text().notNull(),
	providerAccountId: text("provider_account_id").notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: text("token_type"),
	scope: text(),
	idToken: text("id_token"),
	sessionState: text("session_state"),
}, (table) => [
	index("accounts_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "accounts_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const deals = pgTable("deals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	title: text().notNull(),
	sector: text(),
	region: text(),
	size: text(),
	status: dealStatus().default('live').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "deals_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const eois = pgTable("eois", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	dealId: uuid("deal_id").notNull(),
	matchId: uuid("match_id"),
	senderId: uuid("sender_id").notNull(),
	receiverId: uuid("receiver_id").notNull(),
	status: eoiStatus().default('sent').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.dealId],
			foreignColumns: [deals.id],
			name: "eois_deal_id_deals_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.matchId],
			foreignColumns: [matches.id],
			name: "eois_match_id_matches_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.receiverId],
			foreignColumns: [users.id],
			name: "eois_receiver_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "eois_sender_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const matches = pgTable("matches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	dealId: uuid("deal_id").notNull(),
	matchData: jsonb("match_data").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.dealId],
			foreignColumns: [deals.id],
			name: "matches_deal_id_deals_id_fk"
		}).onDelete("cascade"),
]);

export const tokens = pgTable("tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: tokenTransactionType().notNull(),
	amount: integer().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	sessionToken: text("session_token").primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	expires: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("sessions_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const verificationTokens = pgTable("verification_tokens", {
	identifier: text().notNull(),
	token: text().notNull(),
	expires: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	unique("verification_tokens_identifier_unique").on(table.identifier),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	message: text().notNull(),
	isRead: text("is_read").default('false').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text(),
	email: text().notNull(),
	emailVerified: timestamp("email_verified", { mode: 'string' }),
	image: text(),
	phone: text(),
	profileCompletion: integer("profile_completion").default(0),
	tokens: integer().default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	isPhoneVerified: text("is_phone_verified").default('false'),
	firmName: text("firm_name"),
	role: text(),
	category: text().array(),
	customCategory: text("custom_category"),
	baseLocation: text("base_location"),
	geographies: text().array(),
	crossBorder: boolean("cross_border").default(false),
	corridors: text(),
	sectors: text().array(),
	intent: text(),
	prioritySectors: text("priority_sectors").array(),
	coAdvisory: boolean("co_advisory").default(false),
	collaborationModel: text("collaboration_model").array(),
	additionalInfo: text("additional_info"),
	otpCode: text("otp_code"),
	otpExpires: timestamp("otp_expires", { mode: 'string' }),
	otpAttempts: integer("otp_attempts").default(0),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);
