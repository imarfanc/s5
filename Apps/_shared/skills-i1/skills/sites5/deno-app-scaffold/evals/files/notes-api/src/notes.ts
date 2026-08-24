export interface Note {
  id: string;
  body: string;
}

const store: Note[] = [
  { id: "1", body: "buy milk" },
  { id: "2", body: "call the plumber" },
];

export function notes(): Note[] {
  return store;
}
