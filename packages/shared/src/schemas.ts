import { z } from "zod";

// Account schemas
export const accountTypeEnum = z.enum(["asset", "liability", "equity", "revenue", "expense"]);
export const normalBalanceEnum = z.enum(["debit", "credit"]);

export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  type: accountTypeEnum,
  normalBalance: normalBalanceEnum,
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

// Vendor schemas
export const createVendorSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  apAccountId: z.string().uuid(),
});

export const updateVendorSchema = createVendorSchema.partial();

// Customer schemas
export const createCustomerSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  arAccountId: z.string().uuid(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// Journal entry schemas
export const journalEntryStatusEnum = z.enum(["draft", "posted", "void"]);

export const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  credit: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export const createJournalEntrySchema = z.object({
  entryDate: z.string().datetime(),
  description: z.string().max(500),
  fiscalPeriodId: z.string().uuid(),
  lines: z.array(journalLineSchema).min(2),
}).refine(
  (data) => {
    const debits = data.lines.reduce((sum, line) => sum + parseFloat(line.debit || "0"), 0);
    const credits = data.lines.reduce((sum, line) => sum + parseFloat(line.credit || "0"), 0);
    return Math.abs(debits - credits) < 0.01;
  },
  { message: "Debits must equal credits" }
);

// Client registry schemas (for admin)
export const createClientSchema = z.object({
  organizationSlug: z.string().min(3).max(100).regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1).max(200),
});

export const updateClientSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  isProvisioned: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type AccountType = z.infer<typeof accountTypeEnum>;
export type NormalBalance = z.infer<typeof normalBalanceEnum>;
export type JournalEntryStatus = z.infer<typeof journalEntryStatusEnum>;
