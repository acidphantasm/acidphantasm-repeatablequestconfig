import { DependencyContainer } from "tsyringe";

// SPT types
import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import * as fs from "node:fs";
import * as path from "node:path";

class RQC implements IPreAkiLoadMod, IPostDBLoadMod
{
    private mod: string
    private logger: ILogger
    private static config: Config;
    private static configPath = path.resolve(__dirname, "../config/config.json");

    constructor() 
    {
        this.mod = "acidphantasm-RQC"; // Set name of mod so we can log it to console later
    }
    /**
     * Some work needs to be done prior to SPT code being loaded, registering the profile image + setting trader update time inside the trader config json
     * @param container Dependency container
     */
    public preAkiLoad(container: DependencyContainer): void
    {
        // Get a logger
        this.logger = container.resolve<ILogger>("WinstonLogger");

        // Get SPT code/data we need later
        /*
        const preAkiModLoader: PreAkiModLoader = container.resolve<PreAkiModLoader>("PreAkiModLoader");
        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const questConfig = configServer.getConfig(ConfigTypes.QUEST);
        const dailyQuest = questConfig.repeatableQuests[0];
        const weeklyQuest = questConfig.repeatableQuests[1];
        const scavQuest = questConfig.repeatableQuests[2];
        */
    }
    public postDBLoad(container: DependencyContainer): void
    {
        const start = performance.now();
        RQC.config = JSON.parse(fs.readFileSync(RQC.configPath, "utf-8"));

        // Resolve SPT classes we'll use
        const logger = container.resolve<ILogger>("WinstonLogger");

        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const questConfig = configServer.getConfig(ConfigTypes.QUEST);
        const repeatableQuests = questConfig["repeatableQuests"];
        const dailyQuest = repeatableQuests[0];
        const weeklyQuest = repeatableQuests[1];
        const scavQuest = repeatableQuests[2];
        
        if (RQC.config.xpMultiplier !== 1 && RQC.config.xpMultiplier <= 10)
        {
            this.setXPMultiplier(dailyQuest, RQC.config.xpMultiplier);
            this.setXPMultiplier(weeklyQuest, RQC.config.xpMultiplier);
            this.setXPMultiplier(scavQuest, RQC.config.xpMultiplier);
        }
        if (RQC.config.currencyMultiplier !== 1 && RQC.config.xpMultiplier <= 10)
        {
            this.setCurrencyMultiplier(dailyQuest, RQC.config.currencyMultiplier);
            this.setCurrencyMultiplier(weeklyQuest, RQC.config.currencyMultiplier);
            this.setCurrencyMultiplier(scavQuest, RQC.config.currencyMultiplier);
        }
        if (RQC.config.repMultiplier !== 1 && RQC.config.xpMultiplier <= 10)
        {
            this.setRepMultiplier(dailyQuest, RQC.config.repMultiplier);
            this.setRepMultiplier(weeklyQuest, RQC.config.repMultiplier);
            this.setRepMultiplier(scavQuest, RQC.config.repMultiplier);
        }

        if (RQC.config.useStaticType)
        {
            //Set Static Types
            const typeOfQuest:string = this.getStaticConfigType();
            if (typeOfQuest == null)
            {
                logger.log(`[${this.mod}] Unable to set quest types. Broken config. Loading default config instead.`, "red");
            }
            else
            {
                if (RQC.config.debugLogging)
                {
                    logger.log(`[${this.mod}] Setting Repeatable Quests Type: ${typeOfQuest}.`, "yellow");
                }
                this.setStaticQuestType(dailyQuest, typeOfQuest, "green");
                this.setStaticQuestType(weeklyQuest, typeOfQuest, "green");
                this.setStaticFenceType(scavQuest, typeOfQuest, "green");
            }
        } 
        else
        {
            //Set Dynamic Types
            const dailyType = this.getDynamicConfigType(0, "dailyTypes");
            const weeklyType = this.getDynamicConfigType(1, "weeklyTypes");
            const scavType = this.getDynamicConfigType(2, "scavTypes");
            if (dailyType == null || weeklyType == null || scavType == null)
            {
                logger.log(`[${this.mod}] Unable to set quest types. Broken config. Loading default config instead.`, "red");
            } 
            else
            {
                if (RQC.config.debugLogging)
                {
                    logger.log(`[${this.mod}] Setting Daily Repeatable Quests Type: ${dailyType}.`, "yellow");
                    logger.log(`[${this.mod}] Setting Weekly Repeatable Quests Type: ${weeklyType}.`, "yellow");
                    logger.log(`[${this.mod}] Setting Scav Repeatable Quests Type: ${scavType}.`, "yellow");
                }
                this.setDynamicQuestType(dailyQuest, dailyType, "green");
                this.setDynamicQuestType(weeklyQuest, weeklyType, "green");
                this.setDynamicFenceType(scavQuest, scavType, "green");
            }
        }

        this.logger.debug(`[${this.mod}] loaded... `);

        const timeTaken = performance.now() - start;
        logger.log(`[${this.mod}] Configuration took ${timeTaken.toFixed(3)}ms.`, "yellow");
    }

    private getStaticConfigType()
    {
        if (RQC.config.completionOnly)
        {
            return ("Completion");
        }
        else if (RQC.config.explorationOnly)
        {
            return ("Exploration");
        }
        else if (RQC.config.eliminationOnly)
        {
            return ("Elimination");
        }
        else
        {
            return null;
        }
    }

    private getDynamicConfigType(i: number, typeString)
    {
        let validationCheck:boolean = null;
        if (i == 0)
        {
            validationCheck = this.validateDynamicArray(RQC.config.dailyTypes, typeString);
            if (validationCheck)
            {
                return (RQC.config.dailyTypes);
            }
            else
            {
                return null;
            }
        }
        else if (i == 1)
        {
            validationCheck = this.validateDynamicArray(RQC.config.weeklyTypes, typeString);
            if (validationCheck)
            {
                return (RQC.config.weeklyTypes);
            }
            else
            {
                return null;
            }
        }            
        else if (i == 2)
        {
            validationCheck = this.validateDynamicArray(RQC.config.scavTypes, typeString);
            if (validationCheck)
            {
                return (RQC.config.scavTypes);
            }
            else
            {
                return null;
            }
        }
        else 
        {
            return null;
        }
    }

    private setStaticQuestType(typeQuest, typeOfQuest, colour: string)
    {
        typeQuest.types = [typeOfQuest];

        for (let i = 0; i <= 6; i++)
        {
            typeQuest.traderWhitelist[i].questTypes = [typeOfQuest];
            if (RQC.config.debugLogging)
            {
                this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [${typeQuest.traderWhitelist[i].name}] Quest Types to: [${typeQuest.traderWhitelist[i].questTypes}]. `, colour);
            }
        }
    }

    private setStaticFenceType(typeQuest, typeOfQuest, colour: string)
    {
        typeQuest.types = [typeOfQuest];

        typeQuest.traderWhitelist[0].questTypes = [typeOfQuest];           
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [fence] Quest Types to: [${typeQuest.traderWhitelist[0].questTypes}]. `, colour);
        }
    }

    private setDynamicQuestType(typeQuest, typeOfQuest, colour: string)
    {
        typeQuest.types = typeOfQuest;

        for (let i = 0; i <= 6; i++)
        {
            typeQuest.traderWhitelist[i].questTypes = typeOfQuest;
            if (RQC.config.debugLogging)
            {
                this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [${typeQuest.traderWhitelist[i].name}] Quest Types to: [${typeQuest.traderWhitelist[i].questTypes}]. `, colour);
            }
        }
    }

    private setDynamicFenceType(typeQuest, typeOfQuest, colour: string)
    {
        typeQuest.types = typeOfQuest;
        
        typeQuest.traderWhitelist[0].questTypes = typeOfQuest;           
        if (RQC.config.debugLogging)
        {
            this.logger.log(`[${this.mod}] Set [${typeQuest.name}] Trader [fence] Quest Types to: [${typeQuest.traderWhitelist[0].questTypes}]. `, colour);
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
        if (typeCheck.every((i)=> !i) || typeCheckSize != typeCheckCounter)
        {
                    
            if (RQC.config.debugLogging)
            {
                this.logger.log(`[${this.mod}] Validation Failed for: [${typeString}]. Invalid config file.`, "red");
            }
            return false;
        }
        else
        {
            return true;
        }
    }

    private setXPMultiplier(typeQuest, xpMultiplier)
    {
        typeQuest.rewardScaling.experience = typeQuest.rewardScaling.experience.map((xp) => Math.round(xp * xpMultiplier));
    }

    private setCurrencyMultiplier(typeQuest, currencyMultiplier)
    {
        typeQuest.rewardScaling.roubles = typeQuest.rewardScaling.roubles.map((cur) => Math.round(cur * currencyMultiplier));
    }

    private setRepMultiplier(typeQuest, repMultiplier)
    {
        typeQuest.rewardScaling.reputation = typeQuest.rewardScaling.reputation.map((cur) => Math.round(cur * repMultiplier));
    }
}

interface Config 
{
    xpMultiplier: number,
    currencyMultiplier: number,
    repMultiplier: number,
    useStaticType: boolean,
    completionOnly: boolean,
    explorationOnly: boolean,
    eliminationOnly: boolean,
    dailyTypes: string[],
    weeklyTypes: string[],
    scavTypes: string[],
    debugLogging: boolean,
}

module.exports = { mod: new RQC() }