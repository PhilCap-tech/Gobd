/** Serializable result of one read-only count. No names, addresses, or ids. */
export type FristSatzView = {
  ran: boolean;
  /** Customer drafts whose stored answers contain the outdated sentence. */
  drafts: number;
  /** Generated document versions whose stored text contains the outdated sentence. */
  pdfs: number;
  /** In-scope objects whose text was opened, including ones that could not be read. */
  checked: number;
  /** Europe/Berlin time of this response. Empty before the first count. */
  at: string;
  done: boolean;
  /** Opaque continuation. Empty when there is nothing left to read. */
  cursor: string;
  note: string;
};

export const initialFristSatzView: FristSatzView = {
  ran: false,
  drafts: 0,
  pdfs: 0,
  checked: 0,
  at: "",
  done: false,
  cursor: "",
  note: "",
};
