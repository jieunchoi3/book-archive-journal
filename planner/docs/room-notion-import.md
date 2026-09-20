# Notion import — People I've Met

Source CSV: [`src/data/people-ive-met-notion.csv`](../src/data/people-ive-met-notion.csv) (exported from Notion **People I've Met**).

## Columns

| Notion column | App field |
|---------------|-----------|
| Name | `RoomPerson.name` |
| Field/Industry | `fieldIndustry` |
| How We Met | `howWeMet` |
| Date 1 / Date | `metOn`, `lastContactOn` |
| Mbti | `mbti` |
| Location | `location` |
| Note | `note` |
| Compatability | `notionCompatibility` (stored only; **not shown as a rank** in the room UI) |

Rows without a name use a short label derived from the note.

## Import identity

Each row gets a stable `importKey` (`notion:{rowIndex}:…`) so re-import updates the same person instead of duplicating.

## First open

When your room is empty, the Relations tab auto-imports this CSV once into **People you've met** — nobody is placed in the room automatically. Open **Met** and **Invite in** who belongs; then drag them in the room yourself.
