/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // @accounting/shared ships TypeScript source with NodeNext-style './x.js' imports.
  transpilePackages: ['@accounting/shared'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

module.exports = nextConfig
