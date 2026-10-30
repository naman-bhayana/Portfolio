// Runs before React hydrates.
//
// React listens for every DOM event on each root and portal it mounts, animationiteration
// included, although nothing on this site handles it. Chrome takes that listener as a reason
// to wake the main thread at the end of each loop of every CSS animation, and each wake
// re-styles all of them: about sixty frames of work a second on a page that is standing still.
// Without the listener the loops stay on the compositor and the main thread rests.
//
// So React's registration is dropped, for good: React adds it again whenever a portal mounts.
// React marks a root or portal container (_reactListening…) just before it adds its listeners,
// so only those are dropped; anything else that asks for animationiteration still gets it.
const { addEventListener } = EventTarget.prototype
const isReactContainer = (target) => target != null && Object.keys(target).some((key) => key.startsWith('_reactListening'))

EventTarget.prototype.addEventListener = function (type, ...rest) {
  if (type === 'animationiteration' && isReactContainer(this)) return
  return addEventListener.call(this, type, ...rest)
}
