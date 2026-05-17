-- Fixed SQL script for Universal Trainer NPC Setup
DELETE FROM creature_template WHERE entry BETWEEN 1000001 AND 1000010 OR entry BETWEEN 1000101 AND 1000114 OR entry = 9999999;
INSERT INTO creature_template (entry, difficulty_entry_1, difficulty_entry_2, difficulty_entry_3, KillCredit1, KillCredit2, name, subname, IconName, gossip_menu_id, minlevel, maxlevel, exp, faction, npcflag, speed_walk, speed_run, speed_swim, speed_flight, detection_range, `rank`, dmgschool, DamageModifier, BaseAttackTime, RangeAttackTime, BaseVariance, RangeVariance, unit_class, unit_flags, unit_flags2, dynamicflags, family, type, type_flags, lootid, pickpocketloot, skinloot, PetSpellDataId, VehicleId, mingold, maxgold, AIName, MovementType, HoverHeight, HealthModifier, ManaModifier, ArmorModifier, ExperienceModifier, RacialLeader, movementId, RegenHealth, CreatureImmunitiesId, flags_extra, ScriptName, VerifiedBuild) VALUES
(9999999, 0, 0, 0, 0, 0, 'AllFather', 'Master of All Skills', '', 0, 80, 80, 0, 35, 113, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'npc_universal_trainer', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000001, 0, 0, 0, 0, 0, 'Warrior Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000002, 0, 0, 0, 0, 0, 'Paladin Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000003, 0, 0, 0, 0, 0, 'Hunter Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000004, 0, 0, 0, 0, 0, 'Rogue Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000005, 0, 0, 0, 0, 0, 'Priest Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000006, 0, 0, 0, 0, 0, 'Death Knight Trainer', 'Class Trainer', '', 0, 55, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000007, 0, 0, 0, 0, 0, 'Shaman Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000008, 0, 0, 0, 0, 0, 'Mage Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000009, 0, 0, 0, 0, 0, 'Warlock Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000010, 0, 0, 0, 0, 0, 'Druid Trainer', 'Class Trainer', '', 0, 1, 80, 0, 35, 48, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000101, 0, 0, 0, 0, 0, 'Alchemy Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000102, 0, 0, 0, 0, 0, 'Blacksmithing Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000103, 0, 0, 0, 0, 0, 'Cooking Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000104, 0, 0, 0, 0, 0, 'Enchanting Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000105, 0, 0, 0, 0, 0, 'Engineering Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000106, 0, 0, 0, 0, 0, 'First Aid Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000107, 0, 0, 0, 0, 0, 'Fishing Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000108, 0, 0, 0, 0, 0, 'Herbalism Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000109, 0, 0, 0, 0, 0, 'Inscription Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000110, 0, 0, 0, 0, 0, 'Jewelcrafting Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000111, 0, 0, 0, 0, 0, 'Leatherworking Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000112, 0, 0, 0, 0, 0, 'Mining Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000113, 0, 0, 0, 0, 0, 'Skinning Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0),
(1000114, 0, 0, 0, 0, 0, 'Tailoring Trainer', 'Profession Trainer', '', 0, 1, 80, 0, 35, 80, 1, 1.14286, 1, 1, 20, 1, 0, 1, 2000, 2000, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, '', 0);

-- Map virtual class trainer entries to real trainer IDs
DELETE FROM creature_default_trainer WHERE CreatureId BETWEEN 1000001 AND 1000010;
INSERT INTO creature_default_trainer (CreatureId, TrainerId) VALUES
(1000001, 1),   -- Warrior
(1000002, 3),   -- Paladin
(1000003, 7),   -- Hunter
(1000004, 9),   -- Rogue
(1000005, 11),  -- Priest
(1000006, 13),  -- Death Knight
(1000007, 14),  -- Shaman
(1000008, 16),  -- Mage
(1000009, 31),  -- Warlock
(1000010, 33);  -- Druid

-- Map virtual profession trainer entries to real trainer IDs
DELETE FROM creature_default_trainer WHERE CreatureId BETWEEN 1000101 AND 1000114;
INSERT INTO creature_default_trainer (CreatureId, TrainerId) VALUES
(1000101, 65),  -- Alchemy
(1000102, 58),  -- Blacksmithing
(1000103, 75),  -- Cooking
(1000104, 94),  -- Enchanting
(1000105, 84),  -- Engineering
(1000106, 81),  -- First Aid
(1000107, 97),  -- Fishing
(1000108, 69),  -- Herbalism
(1000109, 119), -- Inscription
(1000110, 111), -- Jewelcrafting
(1000111, 61),  -- Leatherworking
(1000112, 78),  -- Mining
(1000113, 100), -- Skinning
(1000114, 72);  -- Tailoring

-- Create a universal trainer that aggregates all spells from all trainers.
-- This is needed so that the AllFather NPC can handle spell purchases via
-- the built-in trainer buy handler, which looks up the trainer by the
-- NPC's creature entry.
DELETE FROM trainer WHERE Id = 9999998;
INSERT INTO trainer (Id, Type, Requirement, Greeting) VALUES
(9999998, 0, 0, 'Welcome, hero. I can teach you anything.');

-- Populate the universal trainer with all spells from all existing trainers.
-- This ensures that when a player buys a spell from the trainer UI,
-- the buy handler can find the spell regardless of which class/profession
-- trainer originally displayed it.
DELETE FROM trainer_spell WHERE TrainerId = 9999998;
INSERT IGNORE INTO trainer_spell (TrainerId, SpellId, MoneyCost, ReqSkillLine, ReqSkillRank, ReqAbility1, ReqAbility2, ReqAbility3, ReqLevel)
SELECT 9999998, SpellId, MoneyCost, ReqSkillLine, ReqSkillRank, ReqAbility1, ReqAbility2, ReqAbility3, ReqLevel
FROM trainer_spell;

-- Map the AllFather NPC to the universal trainer so the buy handler works
DELETE FROM creature_default_trainer WHERE CreatureId = 9999999;
INSERT INTO creature_default_trainer (CreatureId, TrainerId) VALUES
(9999999, 9999998);

-- The AllFather NPC uses a C++ script (npc_universal_trainer) that handles all gossip
-- interactions via OnGossipHello/OnGossipSelect, so no database gossip menus are needed.
-- The script dynamically builds the gossip menus and directly calls SendSpells for
-- the appropriate trainer, bypassing the built-in GOSSIP_OPTION_TRAINER handler.
-- Clean up any stale gossip data that may have been inserted previously.
DELETE FROM gossip_menu_option WHERE MenuID BETWEEN 50005 AND 50007;
DELETE FROM gossip_menu WHERE MenuID BETWEEN 50005 AND 50007;
DELETE FROM npc_text WHERE ID BETWEEN 50005 AND 50007;

-- Set AllFather's npcflag (GOSSIP=1 + TRAINER=16 + TRAINER_CLASS=32 + TRAINER_PROFESSION=64 = 113)
-- gossip_menu_id is set to 0 since the script handles all gossip
UPDATE creature_template SET gossip_menu_id = 0, npcflag = 113 WHERE entry = 9999999;
