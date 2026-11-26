import json, os
R = {}
def put(p, t): R[p] = t
E = 'Evrynthing/'
put(E+'00 Index/eV - Index.md', "---\nwhat: Index\n---\nThe omnipedia of Evrynthing, as Mentor keeps it.\n")
put(E+'03 Entities/eV - Humans.md', "---\nkind_page: true\nwhat: Being\n---\nThe people of Earth.\n")
put(E+"03 Entities/eV - Mentor's students.md", "---\nwhat: Group\nwhere: \"[[eV - Earth]]\"\n---\nThe three who learned from [[eV - Mentor]] in Narvik.\n\n## Members\n- [[eV - Mathias]]\n- [[eV - Ida]]\n")
put(E+'03 Entities/eV - Mathias.md', "---\nwhat: \"[[eV - Humans]]\"\nwhere: \"[[eV - Earth]] [[eV - Narvik]]\"\nwith: \"[[eV - Mentor's students]]\"\n---\nA dependable, left-brain student of [[eV - Mentor]]'s.\n\n> [!picture] canon\n> ![[eV - Mathias - picture (2).jpg]]\n\n## Facts\n- Born: 1994, Narvik\n- Hands: steady\n\n## Story\nMathias grew up under the mountain, counting trains on the ore line. He was the first of the three to notice that Mentor never cast a shadow in the polar night, and the last to say it out loud.\n\nWhen the Rebellion reached Narvik he chose the quiet work: maps, ledgers, the long arithmetic of who could be saved.\n\n## Bonds\n- [[eV - Mentor]] · teacher\n- [[eV - Ida]] · friend\n")
put(E+'03 Entities/eV - Ida.md', "---\nwhat: \"[[eV - Humans]]\"\nwhere: \"[[eV - Narvik]]\"\nwith: \"[[eV - Mentor's students]]\"\n---\nThe loud one, who starts everything.\n\n## Story\nIda paints the walls of the old station.\n")
put(E+'03 Entities/eV - Mentor.md', "---\nwhat: Being\nwhere: \"[[eV - Earth]]\"\n---\nThe one who keeps the omnipedia.\n\n## Story\nNobody remembers Mentor arriving.\n")
put(E+'06 Places/eV - Earth.md', "---\nwhat: Place\n---\nA world at the edge of the unity.\n")
put(E+'06 Places/eV - Narvik.md', "---\nwhat: Place\nwhere: \"[[eV - Earth]]\"\n---\nA harbour town under the mountains, north of the circle.\n\n## Holds\n- [[eV - Mathias]]\n- [[eV - Ida]]\n")
put(E+'07 Events/eV - The Rebellion.md', "---\nwhat: Event\nwhere: \"[[eV - Earth]]\"\n---\nThe year the unity cracked.\n\n## Facts\n- When: Book 1\n\n## Who\n- [[eV - Mathias]]\n- [[eV - Ida]]\n")
put(E+'08 Aura/eV - Kinweave.md', "---\nwhat: Aspect\n---\nThe thread between living things.\n")
put(E+'01 Law/eV - Magia.md', "---\nwhat: Law\n---\nThe rules that hold everywhere.\n")
W='Evrynthing Canon Workbench/'
put(W+'Characters/Mathias.md', "# Mathias\n> Who Mathias is, before Book 1.\n\n## Decide\n### 1. How old is Mathias when Mentor finds him?\n- [ ] **A:** Twelve — *from [[Chat 14]]*\n- [ ] **B:** Sixteen — *from [[Chat 22]]*\n- [ ] Something else:\n\n### 2. Does Mathias know Mentor is not human?\n- [ ] **A:** Yes, from the first night\n- [ ] **B:** Not until the Rebellion\n- [ ] Something else:\n")
put(W+'Places/Narvik.md', "# Narvik\n> The town in Book 1.\n\n## Decide\n### 1. Is the ore line still running?\n- [ ] **A:** Yes\n- [ ] **B:** No, it stopped in the collapse\n")
put('Canon/decisions.json', json.dumps({"schema":1,"decisions":{},"skipped":{},"imported":{},"suggest":{},"checked":{}}))
book = {"structure":{"books":[{"n":1,"t":"The Unity Principle","acts":[{"t":"Act One — The quiet north","eps":[{"t":"The ore line","ch":[{"n":1,"t":"Counting trains","loop":"","play":[]},{"n":2,"t":"The man with no shadow","loop":"","play":[]}]},{"t":"Polar night","ch":[{"n":3,"t":"Ledgers","loop":"","play":[]}]}]}]}]},"meta":{}}
put('Manuscript/book.json', json.dumps(book, indent=1))
put('Manuscript/Ch-01.md', "---\nclearance: 2\nstatus: active\ntype: manuscript-chapter\nbook: 1\nchapter: 1\ntitle: \"Counting trains\"\nstate: drafting\nloop: \"\"\nplay: []\ntouched: 0\n---\nThe ore train came down the mountain at a quarter past six, and Mathias counted it the way other boys counted sheep: forty-two wagons, one engine, a red lamp swinging at the back like a slow heartbeat.\n\nHe had counted it every morning for three years. He knew its sounds better than his father's voice.\n<!-- plate: Mentor arrives -->\nThat was the morning the man without a shadow stood on the platform.\n")
put('Manuscript/Ch-02.md', "---\nclearance: 2\nstatus: active\ntype: manuscript-chapter\nbook: 1\nchapter: 2\ntitle: \"The man with no shadow\"\nstate: blank\nloop: \"\"\nplay: []\ntouched: 0\n---\n")
put('Canon/changesets/CS-006.json', json.dumps({"id":"CS-006","title":"Wiki v6: world sorted","made":"2026-11-22T15:45:00Z","status":"waiting","ops":[{"op":"rewrite","path":"Evrynthing/03 Entities/eV - Mathias.md","before":"old","after":"new"}]}))
json.dump(R, open('repo.json','w'))
print(len(R))
