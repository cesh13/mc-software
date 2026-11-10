// Run from this folder: pnpm db:generate
export default {
  dialect: 'sqlite',
  schema: './schema.ts',
  out: './migrations',
}
