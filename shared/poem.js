// canonical poem. each line carries a short "voice of X" tag (kept for host /
// admin / printed reference - not shown to participants) and a direction
// written as a sentence the participant can act on directly.

export const LINES = [
  {
    id: 1,
    voice: "voice of one half-waking",
    text: "are we crammed - here - in heaven?",
    direction:
      "read the below softly, like you've just woken from a dream and aren't yet sure where you are",
  },
  {
    id: 2,
    voice: "voice of the half-laugh that catches",
    text: "or are we larping home?",
    direction:
      "read the below with a half-laugh, then let it catch in your throat halfway through",
  },
  {
    id: 3,
    voice: "voice of the weary, amused",
    text: "are we cosplaying the sedentary type?",
    direction:
      "read the below as a question to no one - weary, almost amused with yourself",
  },
  {
    id: 4,
    voice: "voice of the conspirator",
    text: "can you hear our roots muttering?",
    direction:
      "read the below like a conspirator - lean toward the room, almost a whisper",
  },
  {
    id: 5,
    voice: "voice of the hailing cry",
    text: "hey",
    direction:
      "read the below as a hailing cry, like you're trying to get someone's attention from far away",
  },
  {
    id: 6,
    voice: "voice of the public announcement",
    text: "remember to measure your distance from catastrophe",
    direction:
      "read the below flat and clinical, the way a public service announcement gets read aloud",
  },
  {
    id: 7,
    voice: "voice of the tender almost-break",
    text: "and, also, you might have to forego desire",
    direction:
      "read the below tender and almost breaking, like you wish you didn't have to say it",
  },
  {
    id: 8,
    voice: "voice of first remembering",
    text: "i wonder:",
    direction:
      "read the below as if you're remembering it for the first time, then sit in a long silence",
  },
  {
    id: 9,
    voice: "voice of the unguarded gaze upward",
    text: "did we fall from the hand of possibility?",
    direction:
      "read the below with a big voice, eyes up, like asking the ceiling",
  },
  {
    id: 10,
    voice: "voice of pronouncement and doubt",
    text: "every branch stared down into otherness",
    direction:
      "read the below like a pronouncement, then let your face show that you don't quite believe what you just said",
  },
  {
    id: 11,
    voice: "voice of the dry-eyed, then grieving",
    text: "my future - i mean my culture - is composting",
    direction:
      "read the below dry and factual, then let a flicker of grief land on the word 'composting'",
  },
  {
    id: 12,
    voice: "voice of direct address",
    text: "asking: how will *you* be reborn?",
    direction:
      "read the below straight at one person in the room, eyes locked, almost confrontational",
  },
  {
    id: 13,
    voice: "voice of the kitchen table after the guests",
    text: "now that heartbreak is your shared art form",
    direction:
      "read the below quietly, the way you'd speak at the kitchen table once the guests have gone",
  },
  {
    id: 14,
    voice: "voice of slow tenderness, almost sung",
    text: "and longing has crow's feet and graying hair",
    direction:
      "read the below slowly, almost sung, with tenderness for the longing itself",
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
