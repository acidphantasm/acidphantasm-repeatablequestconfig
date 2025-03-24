import { DependencyContainer, container } from "tsyringe";

// SPT types
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { IQuestConfig, IRepeatableQuestConfig } from "@spt/models/spt/config/IQuestConfig";
import { IPmcData } from "@spt/models/eft/common/IPmcData";
import { HideoutAreas } from "@spt/models/enums/HideoutAreas";
import { jsonc } from "jsonc";
import * as path from "node:path";
import { FileSystemSync } from "@spt/utils/FileSystemSync";
import { ICompleteQuestRequestData } from "@spt/models/eft/quests/ICompleteQuestRequestData";
import { QuestHelper } from "@spt/helpers/QuestHelper";
import { RepeatableQuestGenerator } from "@spt/generators/RepeatableQuestGenerator";
import { CustomRepeatableQuestController } from "./CustomRepeatableQuestController";
import { QuestController } from "@spt/controllers/QuestController";
import { ICloner } from "@spt/utils/cloners/ICloner";

class RQC implements IPreSptLoadMod, IPostDBLoadMod
{
    private mod: string
    private logger: ILogger
    
    private static fileSystemSync = container.resolve<FileSystemSync>("FileSystemSync");    
    private static config: Config = jsonc.parse(RQC.fileSystemSync.read(path.resolve(__dirname, "../config/config.jsonc")));

    constructor() 
    {
        this.mod = "acidphantasm-repeatablequestconfig";
    }

    // PreSPtLoad
    public preSptLoad(container: DependencyContainer): void
    {
        container.register<CustomRepeatableQuestController>("CustomRepeatableQuestController", CustomRepeatableQuestController);
        container.register("RepeatableQuestController", { useToken: "CustomRepeatableQuestController" });

        container.afterResolution("RepeatableQuestController", (_t, result: any) =>
        {
            result.playerHasDailyScavQuestsUnlocked = (pmcData: IPmcData) =>
            {
                return this.replacementPlayerHasDailyScavQuestsUnlocked(pmcData);
            }
        }, 
        {frequency: "Always"});

        if (RQC.config.instantlyReceiveNewRepeatable)
        {
            container.afterResolution("QuestController", (_t, result: QuestController ) =>
            {
                result.completeQuest = (pmcData: IPmcData, body: ICompleteQuestRequestData, sessionID: string) => 
                {
                    const questHelper = container.resolve<QuestHelper>("QuestHelper");
                    const repeatableQuestGenerator = container.resolve<RepeatableQuestGenerator>("RepeatableQuestGenerator");
                    const customGenerateQuestPool = container.resolve<CustomRepeatableQuestController>("CustomRepeatableQuestController");
                    const cloner = container.resolve<ICloner>("PrimaryCloner");
                    const questConfig: IQuestConfig = container.resolve<ConfigServer>("ConfigServer").getConfig(ConfigTypes.QUEST);
    
                    let newlyGeneratedQuests;
                    let replaced = false;
                    const completedQuestId = body.qid;
                    for (const repeatableType of pmcData.RepeatableQuests) 
                    {
                        const repeatableToReplace = repeatableType.activeQuests.find((activeRepeatable) => activeRepeatable._id === completedQuestId);
                        if (repeatableToReplace) 
                        {
                            const typeToGenerate = repeatableType.name;
                            const repeatableConfig = questConfig.repeatableQuests.find((questType) => questType.name === typeToGenerate);                        
                            const questTypePool = customGenerateQuestPool.customGenerateQuestPool(repeatableConfig, pmcData.Info.Level);
                            const replacementRepeatable = repeatableQuestGenerator.generateRepeatableQuest(sessionID, pmcData.Info.Level, pmcData.TradersInfo, questTypePool, repeatableConfig)
    
                            if (replacementRepeatable)
                            {
                                replacementRepeatable.side = repeatableConfig.side;
                                repeatableType.activeQuests.push(replacementRepeatable);
                                repeatableType.changeRequirement[replacementRepeatable._id] = {
                                    changeCost: replacementRepeatable.changeCost,
                                    changeStandingCost: replacementRepeatable.changeStandingCost
                                }

                                replaced = true;
                            }
    
                            newlyGeneratedQuests = cloner.clone(repeatableType);
                        }
                    }
    
                    const originalResult = questHelper.completeQuest(pmcData, body, sessionID);
    
                    if (replaced) originalResult.profileChanges[sessionID].repeatableQuests = [newlyGeneratedQuests]
                    return originalResult;
                }
            }, 
            {frequency: "Always"});
        }
    }

    // Replace fence quest unlock check if enabled
    public replacementPlayerHasDailyScavQuestsUnlocked(pmcData: IPmcData)
    {
        if (RQC.config.removeIntelCenterRequirement) return true;
        else  return (pmcData?.Hideout?.Areas?.find((hideoutArea) => hideoutArea.type === HideoutAreas.INTEL_CENTER)?.level >= 1);
    }

    // PostDBLoad
    public postDBLoad(container: DependencyContainer): void
    {
        const start = performance.now();

        // Resolve SPT classes we'll use
        this.logger = container.resolve<ILogger>("WinstonLogger");

        const configServer: ConfigServer = container.resolve<ConfigServer>("ConfigServer");
        const questConfig: IQuestConfig = configServer.getConfig(ConfigTypes.QUEST);
        const repeatableQuestList = questConfig.repeatableQuests;
        const dailyQuest = repeatableQuestList[0];
        const weeklyQuest = repeatableQuestList[1];
        const fenceQuest = repeatableQuestList[2];

        if (RQC.config.removeIntelCenterRequirement && RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Intel Center LV1 requirement removed for Fence repeatables.`, "cyan");
        }
        if (RQC.config.useSpecificQuestType && !RQC.config.useRandomQuestType)
        {
            //Set Static Types
            const typeOfQuest:string = this.getStaticConfigType();
            if (typeOfQuest == null)
            {
                this.logger.error(`[${this.mod}] [ERROR] Unable to set quest types. Broken config. Loading default quest types instead.`);
            }
            else
            {
                if (RQC.config.debugLogging)
                {
                    this.logger.log(`[${this.mod}] Setting Repeatable Quests Type: ${typeOfQuest}.`, "magenta");
                }
                this.setStaticQuestType(dailyQuest, typeOfQuest);
                this.setStaticQuestType(weeklyQuest, typeOfQuest);
                this.setStaticFenceType(fenceQuest, typeOfQuest);
            }
        } 
        else if (RQC.config.useRandomQuestType && !RQC.config.useSpecificQuestType)
        {
            //Set Dynamic Types
            const dailyType = this.getDynamicConfigType(0, "dailyTypes");
            const weeklyType = this.getDynamicConfigType(1, "weeklyTypes");
            const fenceType = this.getDynamicConfigType(2, "fenceTypes");
            if (dailyType == null || weeklyType == null || fenceType == null)
            {
                this.logger.error(`[${this.mod}] [ERROR] Unable to set quest types. See above error for troubleshooting. No changes have been made to any quest types.`);
            } 
            else
            {
                if (RQC.config.debugLogging)
                {
                    this.logger.log(`[${this.mod}] Setting Daily Repeatable Quests Type: ${dailyType}.`, "magenta");
                    this.logger.log(`[${this.mod}] Setting Weekly Repeatable Quests Type: ${weeklyType}.`, "magenta");
                    this.logger.log(`[${this.mod}] Setting fence Repeatable Quests Type: ${fenceType}.`, "magenta");
                }
                this.setDynamicQuestType(dailyQuest, dailyType);
                this.setDynamicQuestType(weeklyQuest, weeklyType);
                this.setDynamicFenceType(fenceQuest, fenceType);
            }
        }
        else
        {
            this.logger.error(`[${this.mod}] [ERROR] No changes made to Repeatable Quest Types. If this is not intentional, validate your config settings.`);
        }

        //Set XP Multiplier -- Refactor this code later to be cleaner.
        if (RQC.config.xpMultiplier != 1)
        {
            if (RQC.config.xpMultiplier >= 0.01 && RQC.config.xpMultiplier <= 5 && RQC.config.xpMultiplier)
            {
                this.setXPMultiplier(dailyQuest, RQC.config.xpMultiplier);
                this.setXPMultiplier(weeklyQuest, RQC.config.xpMultiplier);
                this.setXPMultiplier(fenceQuest, RQC.config.xpMultiplier);
            }
            else
            {
                this.logger.error(`[${this.mod}] [ERROR] Unable to set XP Multiplier. Must be between 0.01 - 5. Value out of acceptable range.`);
            }
        }

        //Set Currency Multiplier -- Refactor this code later to be cleaner.
        if (RQC.config.currencyMultiplier != 1)
        {
            if (RQC.config.currencyMultiplier >= 0.01 && RQC.config.currencyMultiplier <= 5)
            {
                this.setCurrencyMultiplier(dailyQuest, RQC.config.currencyMultiplier);
                this.setCurrencyMultiplier(weeklyQuest, RQC.config.currencyMultiplier);
                this.setCurrencyMultiplier(fenceQuest, RQC.config.currencyMultiplier);
            }
            else
            {
                this.logger.error(`[${this.mod}] [ERROR] Unable to set Currency Multiplier. Must be 0.01 - 5. Value out of acceptable range.`);
            }
        }

        //Set Reputation Multiplier -- Refactor this code later to be cleaner.
        if (RQC.config.repMultiplier != 1)
        {
            if (RQC.config.repMultiplier >= 0.01 && RQC.config.repMultiplier <= 5)
            {
                this.setRepMultiplier(dailyQuest, RQC.config.repMultiplier);
                this.setRepMultiplier(weeklyQuest, RQC.config.repMultiplier);
                this.setRepMultiplier(fenceQuest, RQC.config.repMultiplier);
            }
            else
            {
                this.logger.error(`[${this.mod}] [ERROR] Unable to set Reputation Multiplier. Must be 0.01 - 5. Value out of acceptable range.`);
            }
        }

        //Set Skill Reward Chance Multiplier -- Refactor this code later to be cleaner.
        if (RQC.config.skillRewardChanceMultiplier != 1)
        {
            if (RQC.config.skillRewardChanceMultiplier >= 0.01 && RQC.config.skillRewardChanceMultiplier <= 5)
            {
                this.setSkillRewardMultiplier(dailyQuest, RQC.config.skillRewardChanceMultiplier);
                this.setSkillRewardMultiplier(weeklyQuest, RQC.config.skillRewardChanceMultiplier);
                this.setSkillRewardMultiplier(fenceQuest, RQC.config.skillRewardChanceMultiplier);
            }
            else
            {
                this.logger.error(`[${this.mod}] [ERROR] Unable to set Skill Reward Chance Multiplier. Must be 0.01 - 5. Value out of acceptable range.`);
            }
        }

        //Set Skill Point Reward Multiplier -- Refactor this code later to be cleaner.
        if (RQC.config.skillPointRewardMultiplier != 1)
        {
            if (RQC.config.skillPointRewardMultiplier >= 0.01 && RQC.config.skillPointRewardMultiplier <= 5)
            {
                this.setSkillPointRewardMultiplier(dailyQuest, RQC.config.skillPointRewardMultiplier);
                this.setSkillPointRewardMultiplier(weeklyQuest, RQC.config.skillPointRewardMultiplier);
                this.setSkillPointRewardMultiplier(fenceQuest, RQC.config.skillPointRewardMultiplier);
            }
            else
            {
                this.logger.error(`[${this.mod}] [ERROR] Unable to set Skill Point Reward Multiplier. Must be 0.01 - 5. Value out of acceptable range.`);
            }
        }

        //Set Min Player Level for Quests -- Refactor this code later to be cleaner.
        if (RQC.config.dailyMinPlayerLevel >= 1 && 
            RQC.config.weeklyMinPlayerLevel >= 1 &&
            RQC.config.fenceMinPlayerLevel >= 1)
        {
            if (RQC.config.debugLogging)
            {
                this.logger.log(`[${this.mod}] Setting Daily Repeatable Quests minPlayerLevel: ${RQC.config.dailyMinPlayerLevel}.`, "magenta");
                this.logger.log(`[${this.mod}] Setting Weekly Repeatable Quests minPlayerLevel: ${RQC.config.weeklyMinPlayerLevel}.`, "magenta");
                this.logger.log(`[${this.mod}] Setting Fence Repeatable Quests minPlayerLevel: ${RQC.config.fenceMinPlayerLevel}.`, "magenta");
            }
            this.setMinPlayerLevel(dailyQuest, RQC.config.dailyMinPlayerLevel);
            this.setMinPlayerLevel(weeklyQuest, RQC.config.weeklyMinPlayerLevel);
            this.setMinPlayerLevel(fenceQuest, RQC.config.fenceMinPlayerLevel);
        }
        else
        {
            this.logger.error(`[${this.mod}] [ERROR] Unable to set minPlayerLevel. Must be equal to or greater than 1. Value out of acceptable range.`);
        }

        //Set Number of Repeatable Quests -- Refactor this code later to be cleaner.
        if (RQC.config.dailyNumberOfQuests >= 1 && RQC.config.dailyNumberOfQuests <= 15 && 
            RQC.config.weeklyNumberOfQuests >= 1 && RQC.config.weeklyNumberOfQuests <= 15 &&
            RQC.config.fenceNumberOfQuests >= 1 && RQC.config.fenceNumberOfQuests <= 15)
        {
            if (RQC.config.debugLogging)
            {
                this.logger.log(`[${this.mod}] Setting Number of Daily Repeatable Quests: ${RQC.config.dailyNumberOfQuests}.`, "magenta");
                this.logger.log(`[${this.mod}] Setting Number of Weekly Repeatable Quests : ${RQC.config.weeklyNumberOfQuests}.`, "magenta");
                this.logger.log(`[${this.mod}] Setting Number of Fence Repeatable Quests : ${RQC.config.fenceNumberOfQuests}.`, "magenta");
            }
            this.setNumberOfQuests(dailyQuest, RQC.config.dailyNumberOfQuests);
            this.setNumberOfQuests(weeklyQuest, RQC.config.weeklyNumberOfQuests);
            this.setNumberOfQuests(fenceQuest, RQC.config.fenceNumberOfQuests);
        }
        else
        {
            this.logger.error(`[${this.mod}] [ERROR] Unable to set numberOfQuests. Must be between 1 & 15. Value out of acceptable range.`);
        }

        //Set ResetTime of Repeatable Quests -- Refactor this code later to be cleaner.
        if (RQC.config.dailyResetTimer >= 3600 && 
            RQC.config.weeklyResetTimer >= 3600 &&
            RQC.config.fenceResetTimer >= 3600)
        {
            if (RQC.config.debugLogging)
            {
                this.logger.log(`[${this.mod}] Setting Reset Timer of Daily Repeatable Quests: ${RQC.config.dailyResetTimer} seconds.`, "yellow");
                this.logger.log(`[${this.mod}] Setting Reset Timer of Weekly Repeatable Quests : ${RQC.config.weeklyResetTimer} seconds.`, "yellow");
                this.logger.log(`[${this.mod}] Setting Reset Timer of Fence Repeatable Quests : ${RQC.config.fenceResetTimer} seconds.`, "yellow");
            }
            this.setResetTimer(dailyQuest, RQC.config.dailyResetTimer);
            this.setResetTimer(weeklyQuest, RQC.config.weeklyResetTimer);
            this.setResetTimer(fenceQuest, RQC.config.fenceResetTimer);
        }
        else
        {
            this.logger.error(`[${this.mod}] [ERROR] Unable to set reset timers. Must be higher than 3600 seconds. Value out of acceptable range.`);
        }

        if (RQC.config.debugLogging)
        {
            const timeTaken = performance.now() - start;
            this.logger.log(`[${this.mod}] Configuration took ${timeTaken.toFixed(1)}ms.`, "yellow");
        }
    }

    private setMinPlayerLevel(typeQuest: IRepeatableQuestConfig, min)
    {
        typeQuest.minPlayerLevel = min;
    }

    private setNumberOfQuests(typeQuest: IRepeatableQuestConfig, num)
    {
        typeQuest.numQuests = num;
    }

    private setResetTimer(typeQuest: IRepeatableQuestConfig, seconds)
    {
        typeQuest.resetTime = seconds;
    }

    private getStaticConfigType()
    {
        if (RQC.config.completionOnly)
        {
            return ("Completion");
        }
        if (RQC.config.explorationOnly)
        {
            return ("Exploration");
        }
        if (RQC.config.eliminationOnly)
        {
            return ("Elimination");
        }
        return null;
    }

    private getDynamicConfigType(i: number, typeString)
    {
        let validationCheck:boolean = null;
        if (i === 0)
        {
            validationCheck = this.validateDynamicArray(RQC.config.dailyTypes, typeString);
            if (validationCheck)
            {
                return (RQC.config.dailyTypes);
            }
            return null;
        }
        if (i === 1)
        {
            validationCheck = this.validateDynamicArray(RQC.config.weeklyTypes, typeString);
            if (validationCheck)
            {
                return (RQC.config.weeklyTypes);
            }
            return null;
        }            
        if (i === 2)
        {
            validationCheck = this.validateDynamicArray(RQC.config.fenceTypes, typeString);
            if (validationCheck)
            {
                return (RQC.config.fenceTypes);
            }
            return null;
        }
        return null;
    }

    private setStaticQuestType(typeQuest, typeOfQuest)
    {
        typeQuest.types = [typeOfQuest];

        for (let i = 0; i <= 6; i++)
        {
            if (i === 4 && typeOfQuest === "Elimination")
            {
                typeQuest.traderWhitelist[i].questTypes = [];
                if (RQC.config.debugLogging)
                {
                    this.logger.log(`[${this.mod}] Skipping [${typeQuest.name}] Trader [${typeQuest.traderWhitelist[i].name}] - No Locale.  Quest Types to: [${typeQuest.traderWhitelist[i].questTypes}]`, "red");
                }
                continue;
            }
            typeQuest.traderWhitelist[i].questTypes = [typeOfQuest];
            if (RQC.config.debugLogging)
            {
                this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [${typeQuest.traderWhitelist[i].name}] Quest Types to: [${typeQuest.traderWhitelist[i].questTypes}]. `, "yellow");
            }
        }
    }

    private setStaticFenceType(typeQuest, typeOfQuest)
    {
        typeQuest.types = [typeOfQuest];

        typeQuest.traderWhitelist[0].questTypes = [typeOfQuest];           
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [fence] Quest Types to: [${typeQuest.traderWhitelist[0].questTypes}]. `, "yellow");
        }
    }

    private setDynamicQuestType(typeQuest, typeOfQuest)
    {
        typeQuest.types = typeOfQuest;

        for (let i = 0; i <= 6; i++)
        {
            if (i === 4 && typeOfQuest.includes("Elimination"))
            {
                const tempTypeOfQuest = [...typeOfQuest];
                const elimIndex = tempTypeOfQuest.indexOf("Elimination");
                tempTypeOfQuest.splice(elimIndex, 1);
                typeQuest.traderWhitelist[i].questTypes = tempTypeOfQuest;
                
                if (RQC.config.debugLogging)
                {
                    this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [${typeQuest.traderWhitelist[i].name}] Quest Types to: [${typeQuest.traderWhitelist[i].questTypes}]. `, "yellow");
                }
                continue;
            }
            typeQuest.traderWhitelist[i].questTypes = typeOfQuest;
            if (RQC.config.debugLogging)
            {
                this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [${typeQuest.traderWhitelist[i].name}] Quest Types to: [${typeQuest.traderWhitelist[i].questTypes}]. `, "yellow");
            }
        }
    }

    private setDynamicFenceType(typeQuest, typeOfQuest)
    {
        typeQuest.types = typeOfQuest;
        
        typeQuest.traderWhitelist[0].questTypes = typeOfQuest;           
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [fence] Quest Types to: [${typeQuest.traderWhitelist[0].questTypes}]. `, "yellow");
        }
    }

    private validateDynamicArray(typeOfQuest, typeString)
    {
        const typeCheck = typeOfQuest;
        const typeCheckSize = typeCheck.length;
        let typeCheckCounter = 0;
        if (typeCheck.includes("Exploration"))
        {
            ++typeCheckCounter;
        }
        if (typeCheck.includes("Elimination"))
        {
            ++typeCheckCounter;
        }
        if (typeCheck.includes("Completion"))
        {
            ++typeCheckCounter;
        }
        if (typeString == "fenceTypes")
        {
            if (typeCheck.includes("Pickup"))
            {
                ++typeCheckCounter;
            }
        }
        if (typeCheck.every((i)=> !i) || typeCheckSize !== typeCheckCounter)
        {
            this.logger.error(`[${this.mod}] [ERROR] Validation Failed for: [${typeString}]. Invalid config setting!`);
            return false;
        }
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Validation Passed for: [${typeString}]. Valid config setting!`, "green");
        }
        return true;
    }

    private setXPMultiplier(typeQuest: IRepeatableQuestConfig, xpMultiplier)
    {
        typeQuest.rewardScaling.experience = typeQuest.rewardScaling.experience.map((xp) => Math.round(xp * xpMultiplier));
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] XP Multiplier Set for: [${typeQuest.name}]. Array: [${typeQuest.rewardScaling.experience}]`, "cyan");
        }
    }

    private setCurrencyMultiplier(typeQuest: IRepeatableQuestConfig, currencyMultiplier)
    {
        typeQuest.rewardScaling.roubles = typeQuest.rewardScaling.roubles.map((cur) => Math.round(cur * currencyMultiplier));
        typeQuest.rewardScaling.gpCoins =  typeQuest.rewardScaling.gpCoins.map((gp) => Math.round(gp * currencyMultiplier));
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Roubles Currency Multiplier Set for: [${typeQuest.name}]. Array: [${typeQuest.rewardScaling.roubles}]`, "cyan");
            this.logger.log(`[${this.mod}] GP Coins Currency Multiplier Set for: [${typeQuest.name}]. Array: [${typeQuest.rewardScaling.gpCoins}]`, "cyan");
        }
    }

    private setRepMultiplier(typeQuest: IRepeatableQuestConfig, repMultiplier)
    {
        typeQuest.rewardScaling.reputation = typeQuest.rewardScaling.reputation.map((rep) => rep * repMultiplier);
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Reputation Multiplier Set for: [${typeQuest.name}]. Array: [${typeQuest.rewardScaling.reputation}]`, "cyan");
        }
    }

    private setSkillRewardMultiplier(typeQuest: IRepeatableQuestConfig, skillRewardMultiplier)
    {
        typeQuest.rewardScaling.skillRewardChance = typeQuest.rewardScaling.skillRewardChance.map((chance) => chance * skillRewardMultiplier);
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Skill Reward Chance Multiplier Set for: [${typeQuest.name}]. Array: [${typeQuest.rewardScaling.skillRewardChance}]`, "cyan");
        }
    }

    private setSkillPointRewardMultiplier(typeQuest: IRepeatableQuestConfig, skillPointRewardMultiplier)
    {
        typeQuest.rewardScaling.skillPointReward = typeQuest.rewardScaling.skillPointReward.map((chance) => chance * skillPointRewardMultiplier);
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Skill Point Reward Multiplier Set for: [${typeQuest.name}]. Array: [${typeQuest.rewardScaling.skillPointReward}]`, "cyan");
        }
    }
}

interface Config 
{
    instantlyReceiveNewRepeatable: boolean,

    xpMultiplier: number,
    currencyMultiplier: number,
    repMultiplier: number,
    skillRewardChanceMultiplier: number,
    skillPointRewardMultiplier: number,

    dailyMinPlayerLevel: number,
    dailyNumberOfQuests: number,
    dailyResetTimer: number,

    weeklyMinPlayerLevel: number,
    weeklyNumberOfQuests: number,
    weeklyResetTimer: number,

    fenceMinPlayerLevel: number,
    fenceNumberOfQuests: number,
    fenceResetTimer: number,
    removeIntelCenterRequirement: boolean,

    useSpecificQuestType: boolean,
    completionOnly: boolean,
    explorationOnly: boolean,
    eliminationOnly: boolean,
    useRandomQuestType: boolean,
    dailyTypes: string[],
    weeklyTypes: string[],
    fenceTypes: string[],
    debugLogging: boolean,
}

module.exports = { mod: new RQC() }