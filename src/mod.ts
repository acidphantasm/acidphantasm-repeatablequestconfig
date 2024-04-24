import { DependencyContainer } from "tsyringe";

// SPT types
import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { PreAkiModLoader } from "@spt-aki/loaders/PreAkiModLoader";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { IDatabaseTables } from "@spt-aki/models/spt/server/IDatabaseTables";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import * as fs from "node:fs";
import * as path from "node:path";


class RQC implements IPreAkiLoadMod, IPostDBLoadMod
{
    private mod: string
    private logger: ILogger
    private static config: Config;
    private static configPath = path.resolve(__dirname, "../config/config.json");

    constructor() {
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
        const dailyQuest = repeatableQuests[0]
        const weeklyQuest = repeatableQuests[1];
        const scavQuest = repeatableQuests[2];

        if (RQC.config.useStaticType)
        {
            const typeOfQuest = this.getStaticConfigType();
            logger.log(`[${this.mod}] ConfigType ${typeOfQuest}.`, "yellow");
            this.setStaticQuestType(dailyQuest, typeOfQuest, "green");
            this.setStaticQuestType(weeklyQuest, typeOfQuest, "cyan");
            
            //Set Scav Type
            scavQuest.traderWhitelist[0].questTypes = [RQC.config.scavQuestType];
            this.logger.log(`[${this.mod}] Trader [fence] Set Quest Type: [${typeOfQuest}]. `, "green");
        }

        this.logger.debug(`[${this.mod}] loaded... `);

        const timeTaken = performance.now() - start;
        logger.log(`[${this.mod}] Configuration took ${timeTaken.toFixed(3)}ms.`, "green");
    }

    private getStaticConfigType() : string
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
    }

    private setStaticQuestType(typeQuest, typeOfQuest: string, colour: string)
    {
        for (let i = 0; i <= 6; i++)
        {
            typeQuest.traderWhitelist[i].questTypes = [typeOfQuest];
            this.logger.log(`[${this.mod}] Trader [${typeQuest.traderWhitelist[i].name}] Set Quest Type: [${typeOfQuest}]. `, colour);
        }
    }
}

interface Config 
{
    useStaticType: boolean,
    completionOnly: boolean,
    explorationOnly: boolean,
    eliminationOnly: boolean,
    scavQuestType: string,
}

module.exports = { mod: new RQC() }