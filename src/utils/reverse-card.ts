import { isReverseCardId } from "@decks/core";
import type { Flashcard } from "../database/types";

/** A reverse card: its note's card read backwards, front and back swapped. */
export function isReverseCard(card: Pick<Flashcard, "id">): boolean {
  return isReverseCardId(card.id);
}

/** The card as its note holds it: a reverse card turned back round, any other as it is. */
export function forwardCard<T extends Pick<Flashcard, "id" | "front" | "back">>(card: T): T {
  return isReverseCard(card) ? { ...card, front: card.back, back: card.front } : card;
}

/** A reverse card's fields: front and back trade labels, and the note's heading stays the front field. */
export function reverseFieldDefs<F extends { refKey: string; label: string; isFront?: boolean }>(
  fields: F[],
): F[] {
  const front = fields.find((f) => f.refKey === "front");
  const back = fields.find((f) => f.refKey === "back");
  if (!front || !back) return fields;
  return fields.map((f) => {
    if (f === front) return { ...f, label: back.label, isFront: back.isFront };
    if (f === back) return { ...f, label: front.label, isFront: front.isFront };
    return f;
  });
}
