// canonical poem with delivery directions.
// directions are wajdi-mouawad-flavored: operatic in some, intimate in others.

export const LINES = [
  {
    id: 1,
    text: "are we crammed - here - in heaven?",
    direction:
      "softly, as if waking from a dream and not yet sure where you are",
  },
  {
    id: 2,
    text: "or are we larping home?",
    direction: "a half-laugh, then it catches in your throat",
  },
  {
    id: 3,
    text: "are we cosplaying the sedentary type?",
    direction: "a question to no one, weary, almost amused",
  },
  {
    id: 4,
    text: "can you hear our roots muttering?",
    direction: "conspiratorial, lean toward the room, almost a whisper",
  },
  {
    id: 5,
    text: '"hey\nmeasure your distance from catastrophe\nand, also, you might have to forego desire"',
    direction:
      "three voices in one body - the first a hailing cry, the second flat and clinical, the third tender, broken",
  },
  {
    id: 6,
    text: "i wonder:",
    direction: "said as if remembering for the first time, then a long pause",
  },
  {
    id: 7,
    text: "did we fall from the hand of possibility?",
    direction: "wide, unguarded, eyes up, like asking the ceiling",
  },
  {
    id: 8,
    text: "every branch stared down into otherness",
    direction: "as a pronouncement, then doubt of your own pronouncement",
  },
  {
    id: 9,
    text: "my future - i mean my culture - is composting",
    direction:
      "dry, factual, then a small shift on 'composting' - a flicker of grief",
  },
  {
    id: 10,
    text: "asking: how will *you* be reborn?",
    direction:
      "direct address, eye contact with one person in the room, almost confrontational",
  },
  {
    id: 11,
    text: "now that heartbreak is your shared art form",
    direction:
      "quietly, the way one speaks at the kitchen table after the guests have left",
  },
  {
    id: 12,
    text: "and longing has crow's feet and graying hair",
    direction: "slow, almost sung, with tenderness for the longing itself",
  },
];

export function shuffle(lines) {
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
