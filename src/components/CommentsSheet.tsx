import { useState } from 'react'
import { commentsByPost, creatorById, innerCircle, personById } from '../data'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import * as I from './Icons'
import { Sheet } from './Sheet'

const NONE: { id: string; text: string; at: number }[] = []

/**
 * The conversation under an Inner Circle moment. Listeners open onto their
 * vinyl; the creator's own replies wear brass. Yours stay on this device.
 */
export function CommentsSheet({ postId }: { postId: string }) {
  const post = innerCircle.find((p) => p.id === postId)
  const mine = useStore((s) => s.myComments[postId] ?? NONE)
  const addComment = useStore((s) => s.addComment)
  const profile = useStore((s) => s.profile)
  const [draft, setDraft] = useState('')
  const close = () => useUI.getState().openSheet(null)
  if (!post) return null
  const creator = creatorById[post.creatorId]
  const sample = commentsByPost[postId] ?? []
  const send = () => {
    const text = draft.trim()
    if (!text) return
    addComment(postId, text)
    setDraft('')
  }

  return (
    <Sheet label="Comments" onClose={close} title="Comments">
      <div className="comments">
        <ul className="comments__list">
          {sample.map((c, i) => {
            const person = personById[c.by]
            const isCreator = c.by === creator?.id
            const who = person ?? creatorById[c.by]
            if (!who) return null
            const open = () => (person ? useUI.getState().openPerson(person.id) : useUI.getState().openSheet({ kind: 'creator', creatorId: c.by }))
            return (
              <li key={i} className={`comment ${isCreator ? 'comment--creator' : ''}`}>
                <button className="comment__face" onClick={open} aria-label={who.name}>
                  <img src={who.avatar} alt="" />
                </button>
                <div className="comment__body">
                  <p className="comment__meta">
                    <button onClick={open}>{who.name}</button>
                    {isCreator && <span className="comment__badge">Creator</span>}
                    <span className="comment__ago">{c.ago}</span>
                  </p>
                  <p className="comment__text">{c.text}</p>
                </div>
              </li>
            )
          })}
          {mine.map((c) => (
            <li key={c.id} className="comment comment--mine">
              <span className="comment__face">
                <img src={profile.avatar} alt="" />
              </span>
              <div className="comment__body">
                <p className="comment__meta">
                  <span className="comment__name">{profile.name || 'You'}</span>
                  <span className="comment__ago">just now · only you can see this (demo)</span>
                </p>
                <p className="comment__text">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <form
          className="comments__compose"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <img src={profile.avatar} alt="" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add a comment for ${creator?.name ?? 'the creator'}…`} maxLength={240} aria-label="Add a comment" />
          <button type="submit" className="comments__send" disabled={!draft.trim()} aria-label="Post comment">
            <I.Send size={18} />
          </button>
        </form>
      </div>
    </Sheet>
  )
}
