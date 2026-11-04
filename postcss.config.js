// No PostCSS plugins: the browserslist in package.json is Next 16's own floor, so nothing needs
// a prefix added, and a prefixer would strip the -webkit- declarations iOS Safari still reads
// (-webkit-text-size-adjust). An empty `plugins` keeps Next's default chain off as well.
module.exports = {
  plugins: {},
}
