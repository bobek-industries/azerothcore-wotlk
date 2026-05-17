#include "ScriptMgr.h"
#include "ScriptedGossip.h"
#include "Player.h"
#include "Creature.h"
#include "ObjectMgr.h"
#include "Trainer.h"
#include <unordered_map>

// Track original money before free training so we can restore it
static std::unordered_map<ObjectGuid::LowType, uint32> _savedMoney;

enum AllFatherGossip
{
    ACTION_CLASSES      = 1001,
    ACTION_PROFESSIONS  = 1002,
    ACTION_PVP_GEAR     = 1003,
    ACTION_PVE_GEAR     = 1004,
    ACTION_UTILITIES    = 1005,
    ACTION_BACK         = 1006,
    ACTION_CLASS_BASE   = 1010,
    ACTION_PROF_BASE    = 1100,
};

// Virtual creature entries mapped to real trainers via creature_default_trainer
static const uint32 ClassTrainerEntries[] =
{
    1000001, // Warrior
    1000002, // Paladin
    1000003, // Hunter
    1000004, // Rogue
    1000005, // Priest
    1000006, // Death Knight
    1000007, // Shaman
    1000008, // Mage
    1000009, // Warlock
    1000010, // Druid
};

static const uint32 ProfTrainerEntries[] =
{
    1000101, // Alchemy
    1000102, // Blacksmithing
    1000103, // Cooking
    1000104, // Enchanting
    1000105, // Engineering
    1000106, // First Aid
    1000107, // Fishing
    1000108, // Herbalism
    1000109, // Inscription
    1000110, // Jewelcrafting
    1000111, // Leatherworking
    1000112, // Mining
    1000113, // Skinning
    1000114, // Tailoring
};

// ============================================================
// Starter Gear Data
// ============================================================

struct StarterItem
{
    uint32 itemId;
    uint32 count;
};

// --- PvP Sets (Furious Gladiator) per class ---

static const StarterItem PvpGear_Warrior[] =
{
    {40789, 1}, {40807, 1}, {40826, 1}, {40847, 1}, {40866, 1}, // Plate 5pc
    {42069, 1}, {42036, 1}, {42116, 1}, {40889, 1}, {40881, 1}, {40882, 1}, // Offsets
    {44253, 1}, // Trinket
    {42318, 1}, // Decapitator (2H Axe)
};
static const uint32 PvpGear_Warrior_Size = sizeof(PvpGear_Warrior) / sizeof(StarterItem);

static const StarterItem PvpGear_Paladin[] =
{
    {40907, 1}, {40927, 1}, {40933, 1}, {40939, 1}, {40963, 1}, // Ornamented 5pc
    {42072, 1}, {42040, 1}, {42117, 1}, {40983, 1}, {40976, 1}, {40977, 1}, // Offsets
    {44254, 1}, // Trinket
    {42514, 1}, {42565, 1}, // Baton of Light + Barrier
    {42615, 1}, // Libram of Justice
};
static const uint32 PvpGear_Paladin_Size = sizeof(PvpGear_Paladin) / sizeof(StarterItem);

static const StarterItem PvpGear_Hunter[] =
{
    {41087, 1}, {41143, 1}, {41157, 1}, {41205, 1}, {41217, 1}, // Chain 5pc
    {42071, 1}, {42037, 1}, {42116, 1}, {41065, 1}, {41070, 1}, {41075, 1}, // Offsets (Mail)
    {44253, 1}, // Trinket
    {42496, 1}, {45951, 1}, // Heavy Crossbow + Halberd
};
static const uint32 PvpGear_Hunter_Size = sizeof(PvpGear_Hunter) / sizeof(StarterItem);

static const StarterItem PvpGear_Rogue[] =
{
    {41650, 1}, {41767, 1}, {41672, 1}, {41655, 1}, {41683, 1}, // Leather 5pc
    {42069, 1}, {42036, 1}, {42116, 1}, {41640, 1}, {41630, 1}, {41635, 1}, // Offsets (Leather)
    {44253, 1}, // Trinket
    {42256, 1}, {42249, 1}, // Mutilator + Shiv
};
static const uint32 PvpGear_Rogue_Size = sizeof(PvpGear_Rogue) / sizeof(StarterItem);

static const StarterItem PvpGear_Priest[] =
{
    {41859, 1}, {41874, 1}, {41854, 1}, {41864, 1}, {41869, 1}, // Mooncloth 5pc
    {42072, 1}, {42040, 1}, {42117, 1}, {41893, 1}, {41881, 1}, {41885, 1}, // Offsets (Cloth)
    {44254, 1}, // Trinket
    {42353, 1}, {40273, 1}, // Gavel + Surplus Limb
};
static const uint32 PvpGear_Priest_Size = sizeof(PvpGear_Priest) / sizeof(StarterItem);

static const StarterItem PvpGear_DeathKnight[] =
{
    {40787, 1}, {40809, 1}, {40827, 1}, {40848, 1}, {40868, 1}, // Dreadplate 5pc
    {42069, 1}, {42036, 1}, {42116, 1}, {40889, 1}, {40881, 1}, {40882, 1}, // Offsets
    {44253, 1}, // Trinket
    {42318, 1}, // Decapitator (2H Axe)
    {42621, 1}, // Sigil of Strife
};
static const uint32 PvpGear_DeathKnight_Size = sizeof(PvpGear_DeathKnight) / sizeof(StarterItem);

static const StarterItem PvpGear_Shaman[] =
{
    {40992, 1}, {41001, 1}, {41013, 1}, {41027, 1}, {41038, 1}, // Ringmail 5pc
    {42072, 1}, {42040, 1}, {42117, 1}, {41060, 1}, {41051, 1}, {41055, 1}, // Offsets (Mail)
    {44254, 1}, // Trinket
    {42353, 1}, {42565, 1}, // Gavel + Barrier
    {42603, 1}, // Totem of Survival
};
static const uint32 PvpGear_Shaman_Size = sizeof(PvpGear_Shaman) / sizeof(StarterItem);

static const StarterItem PvpGear_Mage[] =
{
    {41953, 1}, {41971, 1}, {41946, 1}, {41959, 1}, {41965, 1}, // Silk 5pc
    {42069, 1}, {42036, 1}, {42116, 1}, {41909, 1}, {41898, 1}, {41903, 1}, // Offsets (Cloth)
    {44255, 1}, // Trinket
    {42347, 1}, {40273, 1}, // Spellblade + Surplus Limb
};
static const uint32 PvpGear_Mage_Size = sizeof(PvpGear_Mage) / sizeof(StarterItem);

static const StarterItem PvpGear_Warlock[] =
{
    {41998, 1}, {42017, 1}, {41993, 1}, {42005, 1}, {42011, 1}, // Felweave 5pc
    {42069, 1}, {42036, 1}, {42116, 1}, {41909, 1}, {41898, 1}, {41903, 1}, // Offsets (Cloth)
    {44255, 1}, // Trinket
    {42347, 1}, {42538, 1}, // Spellblade + Grimoire
};
static const uint32 PvpGear_Warlock_Size = sizeof(PvpGear_Warlock) / sizeof(StarterItem);

static const StarterItem PvpGear_Druid[] =
{
    {41310, 1}, {41287, 1}, {41321, 1}, {41298, 1}, {41275, 1}, // Kodohide 5pc
    {42072, 1}, {42040, 1}, {42117, 1}, {41625, 1}, {41617, 1}, {41621, 1}, // Offsets (Leather)
    {44254, 1}, // Trinket
    {42391, 1}, // Staff
    {42579, 1}, // Idol of Tenacity
};
static const uint32 PvpGear_Druid_Size = sizeof(PvpGear_Druid) / sizeof(StarterItem);

// --- PvE Sets (Valorous / Naxx 25 equivalent) per class ---

static const StarterItem PveGear_Warrior[] =
{
    {40544, 1}, {40527, 1}, {40546, 1}, {40529, 1}, {40530, 1}, // Dreadnaught 5pc
    {44253, 1}, {40683, 1}, // Trinkets
    {40343, 1}, // Armageddon (2H Sword)
};
static const uint32 PveGear_Warrior_Size = sizeof(PveGear_Warrior) / sizeof(StarterItem);

static const StarterItem PveGear_Paladin[] =
{
    {40574, 1}, {40575, 1}, {40571, 1}, {40577, 1}, {40573, 1}, // Redemption 5pc
    {44254, 1}, {40682, 1}, // Trinkets
    {40395, 1}, {40400, 1}, // Torch of Holy Fire + Wall of Terror
    {40705, 1}, // Libram of Renewal
};
static const uint32 PveGear_Paladin_Size = sizeof(PveGear_Paladin) / sizeof(StarterItem);

static const StarterItem PveGear_Hunter[] =
{
    {40503, 1}, {40504, 1}, {40505, 1}, {40506, 1}, {40507, 1}, // Cryptstalker 5pc
    {44253, 1}, {40682, 1}, // Trinkets
    {40385, 1}, {40388, 1}, // Envoy of Mortality + Journey's End
};
static const uint32 PveGear_Hunter_Size = sizeof(PveGear_Hunter) / sizeof(StarterItem);

static const StarterItem PveGear_Rogue[] =
{
    {40495, 1}, {40496, 1}, {40499, 1}, {40500, 1}, {40530, 1}, // Bonescythe 4pc + Dreadnaught shoulders
    {44253, 1}, {40682, 1}, // Trinkets
    {40386, 1}, {40386, 1}, // Sinister Revenge x2 (MH+OH)
};
static const uint32 PveGear_Rogue_Size = sizeof(PveGear_Rogue) / sizeof(StarterItem);

static const StarterItem PveGear_Priest[] =
{
    {45389, 1}, {45392, 1}, {45386, 1}, {45388, 1}, {45390, 1}, // Sanctification 5pc
    {44254, 1}, {40432, 1}, // Trinkets
    {40395, 1}, {40273, 1}, // Torch of Holy Fire + Surplus Limb
};
static const uint32 PveGear_Priest_Size = sizeof(PveGear_Priest) / sizeof(StarterItem);

static const StarterItem PveGear_DeathKnight[] =
{
    {40559, 1}, {40552, 1}, {40554, 1}, {40556, 1}, {40557, 1}, // Scourgeborne 5pc
    {44253, 1}, {40683, 1}, // Trinkets
    {40384, 1}, // Betrayer of Humanity (2H Axe)
    {40207, 1}, // Sigil of Awareness
};
static const uint32 PveGear_DeathKnight_Size = sizeof(PveGear_DeathKnight) / sizeof(StarterItem);

static const StarterItem PveGear_Shaman[] =
{
    {45413, 1}, {45401, 1}, {45402, 1}, {45403, 1}, {45410, 1}, // Worldbreaker 5pc
    {44254, 1}, {40432, 1}, // Trinkets
    {40395, 1}, {40475, 1}, // Torch of Holy Fire + Barricade of Eternity
    {40708, 1}, // Totem of the Elemental Plane
};
static const uint32 PveGear_Shaman_Size = sizeof(PveGear_Shaman) / sizeof(StarterItem);

static const StarterItem PveGear_Mage[] =
{
    {45368, 1}, {46131, 1}, {45365, 1}, {45367, 1}, {45369, 1}, // Kirin Tor 5pc
    {44255, 1}, {40432, 1}, // Trinkets
    {40336, 1}, {40273, 1}, // Life and Death + Surplus Limb
};
static const uint32 PveGear_Mage_Size = sizeof(PveGear_Mage) / sizeof(StarterItem);

static const StarterItem PveGear_Warlock[] =
{
    {40423, 1}, {40422, 1}, {40424, 1}, {45421, 1}, {45422, 1}, // Plagueheart 3pc + Deathbringer 2pc
    {44255, 1}, {40432, 1}, // Trinkets
    {40336, 1}, {42538, 1}, // Life and Death + Grimoire
};
static const uint32 PveGear_Warlock_Size = sizeof(PveGear_Warlock) / sizeof(StarterItem);

static const StarterItem PveGear_Druid[] =
{
    {40463, 1}, {40472, 1}, {40461, 1}, {40462, 1}, {40470, 1}, // Dreamwalker 5pc
    {44254, 1}, {40432, 1}, // Trinkets
    {40388, 1}, // Journey's End (Staff)
    {45509, 1}, // Idol of the Corruptor
};
static const uint32 PveGear_Druid_Size = sizeof(PveGear_Druid) / sizeof(StarterItem);

// --- Utility Items ---

static const StarterItem UtilityItems[] =
{
    {38145, 4},  // Deathweave Bag x4
    {40113, 3},  // Runed Cardinal Ruby x3
    {40111, 3},  // Bold Cardinal Ruby x3
    {40112, 3},  // Delicate Cardinal Ruby x3
    {40147, 3},  // Deadly Ametrine x3
    {40152, 3},  // Potent Ametrine x3
    {40146, 3},  // Fierce Ametrine x3
    {40133, 3},  // Purified Dreadstone x3
    {40129, 3},  // Sovereign Dreadstone x3
    {40119, 3},  // Solid Majestic Zircon x3
    {40121, 3},  // Lustrous Majestic Zircon x3
    {40124, 3},  // Smooth King's Amber x3
    {40123, 3},  // Brilliant King's Amber x3
    {40165, 3},  // Jagged Eye of Zul x3
    {40167, 3},  // Enduring Eye of Zul x3
    {33448, 20}, // Runic Mana Potion x20
    {33447, 20}, // Runic Healing Potion x20
    {40211, 10}, // Potion of Speed x10
    {40212, 10}, // Potion of Wild Magic x10
    {43015, 20}, // Fish Feast x20
    {34057, 10}, // Abyss Crystal x10
    {34129, 1},  // Swift Warstrider
    {46171, 1},  // Furious Gladiator's Frost Wyrm
    {49177, 1},  // Tome of Cold Weather Flight
};
static const uint32 UtilityItems_Size = sizeof(UtilityItems) / sizeof(StarterItem);

// ============================================================
// Helpers
// ============================================================

static void GiveStarterItems(Player* player, const StarterItem* items, uint32 count)
{
    for (uint32 i = 0; i < count; ++i)
        player->StoreNewItemInBestSlots(items[i].itemId, items[i].count);
}

static void GivePvpGear(Player* player)
{
    switch (player->getClass())
    {
        case CLASS_WARRIOR:      GiveStarterItems(player, PvpGear_Warrior, PvpGear_Warrior_Size); break;
        case CLASS_PALADIN:      GiveStarterItems(player, PvpGear_Paladin, PvpGear_Paladin_Size); break;
        case CLASS_HUNTER:       GiveStarterItems(player, PvpGear_Hunter, PvpGear_Hunter_Size); break;
        case CLASS_ROGUE:        GiveStarterItems(player, PvpGear_Rogue, PvpGear_Rogue_Size); break;
        case CLASS_PRIEST:       GiveStarterItems(player, PvpGear_Priest, PvpGear_Priest_Size); break;
        case CLASS_DEATH_KNIGHT: GiveStarterItems(player, PvpGear_DeathKnight, PvpGear_DeathKnight_Size); break;
        case CLASS_SHAMAN:       GiveStarterItems(player, PvpGear_Shaman, PvpGear_Shaman_Size); break;
        case CLASS_MAGE:         GiveStarterItems(player, PvpGear_Mage, PvpGear_Mage_Size); break;
        case CLASS_WARLOCK:      GiveStarterItems(player, PvpGear_Warlock, PvpGear_Warlock_Size); break;
        case CLASS_DRUID:        GiveStarterItems(player, PvpGear_Druid, PvpGear_Druid_Size); break;
    }

    // Faction-specific PvP medallion
    uint32 medallion = player->GetTeamId() == TEAM_ALLIANCE ? 42123 : 42126; // Alliance / Horde
    player->StoreNewItemInBestSlots(medallion, 1);
}

static void GivePveGear(Player* player)
{
    switch (player->getClass())
    {
        case CLASS_WARRIOR:      GiveStarterItems(player, PveGear_Warrior, PveGear_Warrior_Size); break;
        case CLASS_PALADIN:      GiveStarterItems(player, PveGear_Paladin, PveGear_Paladin_Size); break;
        case CLASS_HUNTER:       GiveStarterItems(player, PveGear_Hunter, PveGear_Hunter_Size); break;
        case CLASS_ROGUE:        GiveStarterItems(player, PveGear_Rogue, PveGear_Rogue_Size); break;
        case CLASS_PRIEST:       GiveStarterItems(player, PveGear_Priest, PveGear_Priest_Size); break;
        case CLASS_DEATH_KNIGHT: GiveStarterItems(player, PveGear_DeathKnight, PveGear_DeathKnight_Size); break;
        case CLASS_SHAMAN:       GiveStarterItems(player, PveGear_Shaman, PveGear_Shaman_Size); break;
        case CLASS_MAGE:         GiveStarterItems(player, PveGear_Mage, PveGear_Mage_Size); break;
        case CLASS_WARLOCK:      GiveStarterItems(player, PveGear_Warlock, PveGear_Warlock_Size); break;
        case CLASS_DRUID:        GiveStarterItems(player, PveGear_Druid, PveGear_Druid_Size); break;
    }
}

// ============================================================
// Script
// ============================================================

class npc_universal_trainer : public CreatureScript
{
public:
    npc_universal_trainer() : CreatureScript("npc_universal_trainer") { }

    bool OnGossipHello(Player* player, Creature* creature) override
    {
        // Restore original money if returning from free training
        auto it = _savedMoney.find(player->GetGUID().GetCounter());
        if (it != _savedMoney.end())
        {
            player->SetMoney(it->second);
            _savedMoney.erase(it);
        }

        AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Class Trainer", GOSSIP_SENDER_MAIN, ACTION_CLASSES);
        AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Profession Trainer", GOSSIP_SENDER_MAIN, ACTION_PROFESSIONS);
        AddGossipItemFor(player, GOSSIP_ICON_VENDOR, "PvP Starter Gear", GOSSIP_SENDER_MAIN, ACTION_PVP_GEAR);
        AddGossipItemFor(player, GOSSIP_ICON_VENDOR, "PvE Starter Gear", GOSSIP_SENDER_MAIN, ACTION_PVE_GEAR);
        AddGossipItemFor(player, GOSSIP_ICON_VENDOR, "Utilities (Bags, Gems, Consumables, Mounts)", GOSSIP_SENDER_MAIN, ACTION_UTILITIES);
        SendGossipMenuFor(player, DEFAULT_GOSSIP_MESSAGE, creature->GetGUID());
        return true;
    }

    bool OnGossipSelect(Player* player, Creature* creature, uint32 /*sender*/, uint32 action) override
    {
        if (action == ACTION_CLASSES)
        {
            ClearGossipMenuFor(player);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Warrior", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 0);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Paladin", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 1);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Hunter", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 2);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Rogue", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 3);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Priest", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 4);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Death Knight", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 5);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Shaman", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 6);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Mage", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 7);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Warlock", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 8);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Druid", GOSSIP_SENDER_MAIN, ACTION_CLASS_BASE + 9);
            AddGossipItemFor(player, GOSSIP_ICON_TALK, "Back", GOSSIP_SENDER_MAIN, ACTION_BACK);
            SendGossipMenuFor(player, DEFAULT_GOSSIP_MESSAGE, creature->GetGUID());
        }
        else if (action == ACTION_PROFESSIONS)
        {
            ClearGossipMenuFor(player);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Alchemy", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 0);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Blacksmithing", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 1);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Cooking", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 2);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Enchanting", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 3);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Engineering", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 4);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "First Aid", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 5);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Fishing", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 6);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Herbalism", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 7);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Inscription", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 8);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Jewelcrafting", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 9);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Leatherworking", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 10);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Mining", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 11);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Skinning", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 12);
            AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Tailoring", GOSSIP_SENDER_MAIN, ACTION_PROF_BASE + 13);
            AddGossipItemFor(player, GOSSIP_ICON_TALK, "Back", GOSSIP_SENDER_MAIN, ACTION_BACK);
            SendGossipMenuFor(player, DEFAULT_GOSSIP_MESSAGE, creature->GetGUID());
        }
        else if (action == ACTION_PVP_GEAR)
        {
            GivePvpGear(player);
            if (!player->GetSpecsCount())
                player->ActivateSpec(1);
            CloseGossipMenuFor(player);
        }
        else if (action == ACTION_PVE_GEAR)
        {
            GivePveGear(player);
            if (!player->GetSpecsCount())
                player->ActivateSpec(1);
            CloseGossipMenuFor(player);
        }
        else if (action == ACTION_UTILITIES)
        {
            GiveStarterItems(player, UtilityItems, UtilityItems_Size);
            if (!player->GetSpecsCount())
                player->ActivateSpec(1);
            CloseGossipMenuFor(player);
        }
        else if (action == ACTION_BACK)
        {
            OnGossipHello(player, creature);
        }
        else if (action >= ACTION_CLASS_BASE && action < ACTION_CLASS_BASE + 10)
        {
            uint32 idx = action - ACTION_CLASS_BASE;
            Trainer::Trainer const* trainer = sObjectMgr->GetTrainer(ClassTrainerEntries[idx]);
            if (trainer)
            {
                // Save original money and give enough gold for free training
                _savedMoney[player->GetGUID().GetCounter()] = player->GetMoney();
                player->SetMoney(999999999);
                trainer->SendSpells(creature, player, player->GetSession()->GetSessionDbLocaleIndex());
            }
        }
        else if (action >= ACTION_PROF_BASE && action < ACTION_PROF_BASE + 14)
        {
            uint32 idx = action - ACTION_PROF_BASE;
            Trainer::Trainer const* trainer = sObjectMgr->GetTrainer(ProfTrainerEntries[idx]);
            if (trainer)
            {
                // Save original money and give enough gold for free training
                _savedMoney[player->GetGUID().GetCounter()] = player->GetMoney();
                player->SetMoney(999999999);
                trainer->SendSpells(creature, player, player->GetSession()->GetSessionDbLocaleIndex());
            }
        }

        return true;
    }
};

void AddSC_npc_universal_trainer()
{
    new npc_universal_trainer();
}
