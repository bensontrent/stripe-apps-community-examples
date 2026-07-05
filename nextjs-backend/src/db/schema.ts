import { relations } from 'drizzle-orm';
import {
    boolean,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Naming conventions
//
// auth_*     Better Auth's required models (sign-in). `auth_accounts` is
//            Better Auth's "account" model — a credential or OAuth sign-in
//            method. It is unrelated to Stripe accounts.
//
// stripe_*   The merchant side: the connected Stripe accounts the app is
//            installed into. Users <-> Stripe accounts is many-to-many
//            (`stripe_account_users`). A Stripe account keeps the same
//            acct_ id in live and test mode, so `stripe_accounts` has one
//            row per account, and anything mode-specific (installations,
//            settings) carries a `livemode` flag mirroring Stripe's own
//            live/test distinction — live rows never affect test rows.
//
// billing_*  The publisher side: when the app is monetized, each user
//            exists as a Customer in the app publisher's own Stripe
//            account, with subscriptions tracked per user.
// ---------------------------------------------------------------------------

// ===== Better Auth ==========================================================

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false),
    name: text('name'),
    image: text('image'),
    // App-global preferences that don't depend on a Stripe account or mode.
    settings: jsonb('settings'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Better Auth's "account" model: one row per sign-in method (email/password
// credential or OAuth provider) per user. Not a Stripe account.
export const authAccounts = pgTable('auth_accounts', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Better Auth's "verification" model (email verification, password reset).
export const verifications = pgTable('verifications', {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== Merchant side: connected Stripe accounts ============================

// One row per Stripe account (acct_...). The same acct_ id covers both live
// and test mode; mode-specific data lives in the child tables below.
export const stripeAccounts = pgTable('stripe_accounts', {
    id: uuid('id').primaryKey().defaultRandom(),
    stripeAccountId: text('stripe_account_id').notNull().unique(),
    name: text('name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Many-to-many: a user can belong to several Stripe accounts, and a Stripe
// account has several users. Membership is mode-independent.
export const stripeAccountUsers = pgTable(
    'stripe_account_users',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        stripeAccountId: text('stripe_account_id')
            .notNull()
            .references(() => stripeAccounts.stripeAccountId, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (t) => [unique('stripe_account_users_user_account_unique').on(t.userId, t.stripeAccountId)],
);

// The app is installed per account *per mode* (test-mode installs are
// separate from live-mode installs).
export const stripeAppInstallations = pgTable(
    'stripe_app_installations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        stripeAccountId: text('stripe_account_id')
            .notNull()
            .references(() => stripeAccounts.stripeAccountId, { onDelete: 'cascade' }),
        livemode: boolean('livemode').notNull(),
        installationId: text('installation_id').notNull(),
        isActive: boolean('is_active').default(true),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (t) => [unique('stripe_app_installations_account_mode_unique').on(t.stripeAccountId, t.livemode)],
);

// Account-wide settings shared by every user of that Stripe account,
// isolated per mode (e.g. the company office address).
export const stripeAccountSettings = pgTable(
    'stripe_account_settings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        stripeAccountId: text('stripe_account_id')
            .notNull()
            .references(() => stripeAccounts.stripeAccountId, { onDelete: 'cascade' }),
        livemode: boolean('livemode').notNull(),
        settings: jsonb('settings').notNull().default({}),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (t) => [unique('stripe_account_settings_account_mode_unique').on(t.stripeAccountId, t.livemode)],
);

// Per-user settings *within* a Stripe account, isolated per mode (e.g. which
// address is this user's local company address).
export const stripeAccountUserSettings = pgTable(
    'stripe_account_user_settings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        stripeAccountId: text('stripe_account_id')
            .notNull()
            .references(() => stripeAccounts.stripeAccountId, { onDelete: 'cascade' }),
        livemode: boolean('livemode').notNull(),
        settings: jsonb('settings').notNull().default({}),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (t) => [
        unique('stripe_account_user_settings_user_account_mode_unique').on(
            t.userId,
            t.stripeAccountId,
            t.livemode,
        ),
    ],
);

// ===== Publisher side: monetization =========================================

// Each app user exists as a Customer (cus_...) in the app publisher's own
// Stripe account — one per mode, so test billing never touches live billing.
export const billingCustomers = pgTable(
    'billing_customers',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        stripeCustomerId: text('stripe_customer_id').notNull().unique(),
        livemode: boolean('livemode').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (t) => [unique('billing_customers_user_mode_unique').on(t.userId, t.livemode)],
);

export const billingSubscriptions = pgTable('billing_subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    livemode: boolean('livemode').notNull(),
    status: text('status').notNull(),
    priceId: text('price_id'),
    quantity: integer('quantity'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    endedAt: timestamp('ended_at'),
    cancelAt: timestamp('cancel_at'),
    canceledAt: timestamp('canceled_at'),
    trialStart: timestamp('trial_start'),
    trialEnd: timestamp('trial_end'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== Relations ============================================================

export const usersRelations = relations(users, ({ many }) => ({
    accountMemberships: many(stripeAccountUsers),
    accountUserSettings: many(stripeAccountUserSettings),
    billingCustomers: many(billingCustomers),
    billingSubscriptions: many(billingSubscriptions),
}));

export const stripeAccountsRelations = relations(stripeAccounts, ({ many }) => ({
    members: many(stripeAccountUsers),
    installations: many(stripeAppInstallations),
    settings: many(stripeAccountSettings),
    userSettings: many(stripeAccountUserSettings),
}));

export const stripeAccountUsersRelations = relations(stripeAccountUsers, ({ one }) => ({
    user: one(users, {
        fields: [stripeAccountUsers.userId],
        references: [users.id],
    }),
    stripeAccount: one(stripeAccounts, {
        fields: [stripeAccountUsers.stripeAccountId],
        references: [stripeAccounts.stripeAccountId],
    }),
}));

export const stripeAppInstallationsRelations = relations(stripeAppInstallations, ({ one }) => ({
    stripeAccount: one(stripeAccounts, {
        fields: [stripeAppInstallations.stripeAccountId],
        references: [stripeAccounts.stripeAccountId],
    }),
}));

export const stripeAccountSettingsRelations = relations(stripeAccountSettings, ({ one }) => ({
    stripeAccount: one(stripeAccounts, {
        fields: [stripeAccountSettings.stripeAccountId],
        references: [stripeAccounts.stripeAccountId],
    }),
}));

export const stripeAccountUserSettingsRelations = relations(stripeAccountUserSettings, ({ one }) => ({
    user: one(users, {
        fields: [stripeAccountUserSettings.userId],
        references: [users.id],
    }),
    stripeAccount: one(stripeAccounts, {
        fields: [stripeAccountUserSettings.stripeAccountId],
        references: [stripeAccounts.stripeAccountId],
    }),
}));

// ===== Type exports =========================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type AuthAccount = typeof authAccounts.$inferSelect;
export type NewAuthAccount = typeof authAccounts.$inferInsert;
export type StripeAccount = typeof stripeAccounts.$inferSelect;
export type NewStripeAccount = typeof stripeAccounts.$inferInsert;
export type StripeAccountUser = typeof stripeAccountUsers.$inferSelect;
export type NewStripeAccountUser = typeof stripeAccountUsers.$inferInsert;
export type StripeAppInstallation = typeof stripeAppInstallations.$inferSelect;
export type NewStripeAppInstallation = typeof stripeAppInstallations.$inferInsert;
export type StripeAccountSetting = typeof stripeAccountSettings.$inferSelect;
export type NewStripeAccountSetting = typeof stripeAccountSettings.$inferInsert;
export type StripeAccountUserSetting = typeof stripeAccountUserSettings.$inferSelect;
export type NewStripeAccountUserSetting = typeof stripeAccountUserSettings.$inferInsert;
export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type NewBillingCustomer = typeof billingCustomers.$inferInsert;
export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type NewBillingSubscription = typeof billingSubscriptions.$inferInsert;
