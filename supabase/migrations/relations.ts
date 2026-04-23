import { relations } from "drizzle-orm/relations";
import { users, accounts, deals, eois, matches, tokens, sessions, notifications } from "./schema";

export const accountsRelations = relations(accounts, ({one}) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	accounts: many(accounts),
	deals: many(deals),
	eois_receiverId: many(eois, {
		relationName: "eois_receiverId_users_id"
	}),
	eois_senderId: many(eois, {
		relationName: "eois_senderId_users_id"
	}),
	tokens: many(tokens),
	sessions: many(sessions),
	notifications: many(notifications),
}));

export const dealsRelations = relations(deals, ({one, many}) => ({
	user: one(users, {
		fields: [deals.userId],
		references: [users.id]
	}),
	eois: many(eois),
	matches: many(matches),
}));

export const eoisRelations = relations(eois, ({one}) => ({
	deal: one(deals, {
		fields: [eois.dealId],
		references: [deals.id]
	}),
	match: one(matches, {
		fields: [eois.matchId],
		references: [matches.id]
	}),
	user_receiverId: one(users, {
		fields: [eois.receiverId],
		references: [users.id],
		relationName: "eois_receiverId_users_id"
	}),
	user_senderId: one(users, {
		fields: [eois.senderId],
		references: [users.id],
		relationName: "eois_senderId_users_id"
	}),
}));

export const matchesRelations = relations(matches, ({one, many}) => ({
	eois: many(eois),
	deal: one(deals, {
		fields: [matches.dealId],
		references: [deals.id]
	}),
}));

export const tokensRelations = relations(tokens, ({one}) => ({
	user: one(users, {
		fields: [tokens.userId],
		references: [users.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));