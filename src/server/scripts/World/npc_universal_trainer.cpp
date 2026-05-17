#include "ScriptMgr.h"
#include "ScriptedGossip.h"
#include "Player.h"
#include "Creature.h"
#include "ObjectMgr.h"
#include "Trainer.h"
#include "DBCStores.h"
#include "ItemTemplate.h"

enum AllFatherGossip
{
    ACTION_CLASSES      = 1001,
    ACTION_PROFESSIONS  = 1002,
    ACTION_START_GEAR   = 1003,
    ACTION_BACK         = 1004,
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

class npc_universal_trainer : public CreatureScript
{
public:
    npc_universal_trainer() : CreatureScript("npc_universal_trainer") { }

    bool OnGossipHello(Player* player, Creature* creature) override
    {
        AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Class Trainer", GOSSIP_SENDER_MAIN, ACTION_CLASSES);
        AddGossipItemFor(player, GOSSIP_ICON_TRAINER, "Profession Trainer", GOSSIP_SENDER_MAIN, ACTION_PROFESSIONS);
        AddGossipItemFor(player, GOSSIP_ICON_VENDOR, "Get Start Gear", GOSSIP_SENDER_MAIN, ACTION_START_GEAR);
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
        else if (action == ACTION_START_GEAR)
        {
            CharStartOutfitEntry const* oEntry =
                GetCharStartOutfitEntry(player->getRace(), player->getClass(), player->getGender());
            if (oEntry)
            {
                for (int j = 0; j < MAX_OUTFIT_ITEMS; ++j)
                {
                    if (oEntry->ItemId[j] <= 0)
                        continue;

                    uint32 itemId = oEntry->ItemId[j];

                    ItemTemplate const* iProto = sObjectMgr->GetItemTemplate(itemId);
                    if (!iProto)
                        continue;

                    uint32 count = iProto->BuyCount;

                    // special amount for food/drink
                    if (iProto->Class == ITEM_CLASS_CONSUMABLE &&
                        iProto->SubClass == ITEM_SUBCLASS_FOOD)
                    {
                        switch (iProto->Spells[0].SpellCategory)
                        {
                            case SPELL_CATEGORY_FOOD:
                                count = player->IsClass(CLASS_DEATH_KNIGHT, CLASS_CONTEXT_INIT) ? 10 : 4;
                                break;
                            case SPELL_CATEGORY_DRINK:
                                count = 2;
                                break;
                        }
                        if (iProto->GetMaxStackSize() < count)
                            count = iProto->GetMaxStackSize();
                    }

                    player->StoreNewItemInBestSlots(itemId, count);
                }
            }

            // also give items from playercreateinfo_item table
            PlayerInfo const* info = sObjectMgr->GetPlayerInfo(player->getRace(), player->getClass());
            if (info)
            {
                for (PlayerCreateInfoItems::const_iterator itemItr = info->item.begin();
                     itemItr != info->item.end(); ++itemItr)
                    player->StoreNewItemInBestSlots(itemItr->item_id, itemItr->item_amount);
            }

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
                trainer->SendSpells(creature, player, player->GetSession()->GetSessionDbLocaleIndex());
                CloseGossipMenuFor(player);
            }
        }
        else if (action >= ACTION_PROF_BASE && action < ACTION_PROF_BASE + 14)
        {
            uint32 idx = action - ACTION_PROF_BASE;
            Trainer::Trainer const* trainer = sObjectMgr->GetTrainer(ProfTrainerEntries[idx]);
            if (trainer)
            {
                trainer->SendSpells(creature, player, player->GetSession()->GetSessionDbLocaleIndex());
                CloseGossipMenuFor(player);
            }
        }

        return true;
    }
};

void AddSC_npc_universal_trainer()
{
    new npc_universal_trainer();
}
