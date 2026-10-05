// The same nodes with a space between each pair. In a flex or grid row the space takes no
// room, but it keeps neighbouring words apart for anything that reads the HTML as plain text:
// crawlers, answer engines, reader modes.
export const spaced = (nodes) => nodes.flatMap((node, i) => (i ? [' ', node] : [node]))
