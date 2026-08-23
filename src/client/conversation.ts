/**
 * Read-only helpers over the conversation snapshot: locate one assistant
 * message's chat node by its stable message id and extract its visible prose.
 * These stay type-loose at the node `data` boundary because the runtime's
 * `ChatConversationViewNode` deliberately omits the renderer-owned `data`
 * payload (the concrete `ChatNode` union adds it).
 * @module dsh-skill-7d-viewer/client/conversation
 */

import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

/** A text-capable content block (structural subset of the runtime AssistantBlock). */
interface TextBlock {
  readonly kind: string
  readonly text?: string
}

/** The renderer-owned payload carried by an `assistant-step` chat node. */
interface AssistantNodeData {
  readonly blocks?: readonly TextBlock[]
  readonly finalNode?: { readonly messageId?: string }
}

/** A chat node narrowed to the fields the bookmark flow needs. */
export interface AssistantNodeRef {
  /** Engine-owned chat node key; also the `data-chat-anchor-key` DOM attribute. */
  readonly key: string
  readonly id: string
  readonly data?: AssistantNodeData
}

/** Concatenate the visible text blocks of one assistant message. */
export function assistantText(blocks: readonly TextBlock[]): string {
  return blocks.flatMap(block => block.kind === 'text' ? [block.text ?? ''] : []).join('')
}

/**
 * Find the chat node whose durable message identity matches `messageId`.
 * Matching falls back to the node's own `id` for renderers that mirror the
 * message id there rather than on the finalNode payload.
 * @param snapshot - the live conversation snapshot from `useSession`.
 * @param messageId - the stable assistant message id.
 * @returns the node (stable reference) or undefined when it is out of window.
 */
export function findAssistantNode(
  snapshot: ConversationSnapshot,
  messageId: string,
): AssistantNodeRef | undefined {
  for (const node of snapshot.chat.nodes.values()) {
    const data = (node as AssistantNodeRef).data
    if (data?.finalNode?.messageId === messageId || node.id === messageId) {
      return node as AssistantNodeRef
    }
  }
  return undefined
}
