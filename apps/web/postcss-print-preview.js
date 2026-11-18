// Copies every Tailwind `print:` rule out of `@media print` and scopes it to
// `html.print-preview`, so the on-screen print preview (src/lib/print.ts)
// shows the same layout the printer gets. Other `@media print` rules (the
// preview's own chrome in globals.css) are left alone.
module.exports = () => ({
  postcssPlugin: 'print-preview',
  OnceExit(root) {
    root.walkAtRules('media', (media) => {
      if (media.params.trim() !== 'print') return
      const clones = []
      media.each((node) => {
        if (node.type !== 'rule' || !node.selector.includes('print\\:')) return
        clones.push(node.clone({ selectors: node.selectors.map((s) => `html.print-preview ${s}`) }))
      })
      if (clones.length) media.after(clones)
    })
  },
})
module.exports.postcss = true
