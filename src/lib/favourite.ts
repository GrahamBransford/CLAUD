import { creatorById } from '../data'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'

const KEY = 'circa-first-favourite'

/**
 * Star or unstar a creator. The first time someone stars anyone, a note says
 * that favourites show on their record, where friends can see them. It shows
 * once per device.
 */
export function toggleFavourite(creatorId: string) {
  const on = useStore.getState().toggleFavorite(creatorId)
  if (!on) return on
  let seen = false
  try {
    seen = localStorage.getItem(KEY) === 'done'
    localStorage.setItem(KEY, 'done')
  } catch {
    /* storage blocked: show it this time */
  }
  if (!seen) {
    const c = creatorById[creatorId]
    useUI.getState().pushToast({
      image: c?.avatar,
      title: c ? `First favourite: ${c.name}` : 'Your first favourite',
      detail: 'Favourites wear a star on your record, so friends can see who you love most.',
      ms: 5200,
    })
  }
  return on
}
