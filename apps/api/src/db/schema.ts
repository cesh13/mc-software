import { pgTable, varchar, boolean, timestamp, uuid, numeric, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const accountTypeEnum = pgEnum("account_type", ["asset", "liability", "equity", "revenue", "expense"]);
export const normalBalanceEnum = pgEnum("normal_balance", ["debit", "credit"]);
export const journalEntryStatusEnum = pgEnum("journal_entry_status", ["draft", "posted", "void"]);

// Accounts
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  type: accountTypeEnum("type").notNull(),
  normalBalance: normalBalanceEnum("normal_balance").notNull(),
  parentId: uuid("parent_id"),
  description: varchar("description", { length: 500 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
  }),
  children: many(accounts),
}));

// Vendors
export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  address: varchar("address", { length: 500 }),
  apAccountId: uuid("ap_account_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vendorsRelations = relations(vendors, ({ one }) => ({
  apAccount: one(accounts, {
    fields: [vendors.apAccountId],
    references: [accounts.id],
  }),
}));

// Customers
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  address: varchar("address", { length: 500 }),
  arAccountId: uuid("ar_account_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customersRelations = relations(customers, ({ one }) => ({
  arAccount: one(accounts, {
    fields: [customers.arAccountId],
    references: [accounts.id],
  }),
}));

// Fiscal Periods
export const fiscalPeriods = pgTable("fiscal_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Journal Entries
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryNumber: varchar("entry_number", { length: 50 }).notNull().unique(),
  entryDate: timestamp("entry_date").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  status: journalEntryStatusEnum("status").notNull().default("draft"),
  fiscalPeriodId: uuid("fiscal_period_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  fiscalPeriod: one(fiscalPeriods, {
    fields: [journalEntries.fiscalPeriodId],
    references: [fiscalPeriods.id],
  }),
  lines: many(journalLines),
}));

// Journal Lines
export const journalLines = pgTable("journal_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  journalEntryId: uuid("journal_entry_id").notNull(),
  accountId: uuid("account_id").notNull(),
  debit: numeric("debit", { precision: 18, scale: 2 }).notNull().default("0.00"),
  credit: numeric("credit", { precision: 18, scale: 2 }).notNull().default("0.00"),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(accounts, {
    fields: [journalLines.accountId],
    references: [accounts.id],
  }),
}));
