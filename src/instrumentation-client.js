// Runs before React hydrates.
//
// React listens for every DOM event on each root and portal it mounts, animationiteration
// included, although nothing on this site handles it. Chrome takes that listener as a reason
// to wake the main thread at the end of each loop of every CSS animation, and each wake
// re-styles all of them: about sixty frames of work a second on a page that is standing still.
// Without the listener the loops stay on the compositor and the main thread rests.
//
// So that one registration is dropped, for good: React adds it again whenever a portal mounts.
// If something here ever needs animationiteration, this is the place to let it through.
const { addEventListener } = EventTarget.prototype

EventTarget.prototype.addEventListener = function (type, ...rest) {
  if (type === 'animationiteration') return
  return addEventListener.call(this, type, ...rest)
}
