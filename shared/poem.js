// canonical poem. each line carries a short "voice of X" tag (used in the
// participant prompt: "read this with the voice of...") and a longer direction
// for performers who want more guidance. directions are wajdi-mouawad-flavored:
// operatic in some, intimate in others.

export const LINES = [
  {
    id: 1,
    voice: "voice of one half-waking",
    text: "are we crammed - here - in heaven?",
    direction:
      "softly, as if waking from a dream and not yet sure where you are",
  },
  {
    id: 2,
    voice: "voice of the half-laugh that catches",
    text: "or are we larping home?",
    direction: "a half-laugh, then it catches in your throat",
  },
  {
    id: 3,
    voice: "voice of the weary, amused",
    text: "are we cosplaying the sedentary type?",
    direction: "a question to no one, weary, almost amused",
  },
  {
    id: 4,
    voice: "voice of the conspirator",
    text: "can you hear our roots muttering?",
    direction: "conspiratorial, lean toward the room, almost a whisper",
  },
  {
    id: 5,
    voice: "voice of three in one body",
    text: '"hey\nmeasure your distance from catastrophe\nand, also, you might have to forego desire"',
    direction:
      "three voices in one body - the first a hailing cry, the second flat and clinical, the third tender, broken",
  },
  {
    id: 6,
    voice: "voice of first remembering",
    text: "i wonder:",
    direction: "said as if remembering for the first time, then a long pause",
  },
  {
    id: 7,
    voice: "voice of the unguarded gaze upward",
    text: "did we fall from the hand of possibility?",
    direction: "wide, unguarded, eyes up, like asking the ceiling",
  },
  {
    id: 8,
    voice: "voice of pronouncement and doubt",
    text: "every branch stared down into otherness",
    direction: "as a pronouncement, then doubt of your own pronouncement",
  },
  {
    id: 9,
    voice: "voice of the dry-eyed, then grieving",
    text: "my future - i mean my culture - is composting",
    direction:
      "dry, factual, then a small shift on 'composting' - a flicker of grief",
  },
  {
    id: 10,
    voice: "voice of direct address",
    text: "asking: how will *you* be reborn?",
    direction:
      "direct address, eye contact with one person in the room, almost confrontational",
  },
  {
    id: 11,
    voice: "voice of the kitchen table after the guests",
    text: "now that heartbreak is your shared art form",
    direction:
      "quietly, the way one speaks at the kitchen table after the guests have left",
  },
  {
    id: 12,
    voice: "voice of slow tenderness, almost sung",
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
