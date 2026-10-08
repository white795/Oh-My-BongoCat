// Compatibility facade for the frozen guitar engine. New MikuCat modes use
// the neutral class name directly so the spring implementation stays shared.
export { MikuCatHairMotion as GuitarHairMotion } from './mikucatHairMotion'
export type { MikuCatHairParameterId as GuitarHairParameterId } from './mikucatHairMotion'
