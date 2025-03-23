import { inject, injectable } from "tsyringe";

import { IEmptyRequestData } from "@spt/models/eft/common/IEmptyRequestData";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { HttpResponseUtil } from "@spt/utils/HttpResponseUtil";
import { RepeatableQuestController } from "@spt/controllers/RepeatableQuestController";
import { RepeatableQuestHelper } from "@spt/helpers/RepeatableQuestHelper";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { DatabaseService } from "@spt/services/DatabaseService";
import { LocalisationService } from "@spt/services/LocalisationService";
import { ICloner } from "@spt/utils/cloners/ICloner";
import { HashUtil } from "@spt/utils/HashUtil";
import { RandomUtil } from "@spt/utils/RandomUtil";
import { RepeatableQuestGenerator } from "@spt/generators/RepeatableQuestGenerator";
import { ProfileHelper } from "@spt/helpers/ProfileHelper";
import { QuestHelper } from "@spt/helpers/QuestHelper";
import { EventOutputHolder } from "@spt/routers/EventOutputHolder";
import { PaymentService } from "@spt/services/PaymentService";
import { ProfileFixerService } from "@spt/services/ProfileFixerService";
import { TimeUtil } from "@spt/utils/TimeUtil";
import { IRepeatableQuestConfig } from "@spt/models/spt/config/IQuestConfig";
import { IQuestTypePool } from "@spt/models/spt/repeatable/IQuestTypePool";


@injectable()
export class CustomRepeatableQuestController extends RepeatableQuestController
{
    constructor(
        @inject("PrimaryLogger") protected logger: ILogger,
        @inject("HashUtil") protected hashUtil: HashUtil,
        @inject("DatabaseService") protected databaseService: DatabaseService,
        @inject("TimeUtil") protected timeUtil: TimeUtil,
        @inject("RandomUtil") protected randomUtil: RandomUtil,
        @inject("HttpResponseUtil") protected httpResponse: HttpResponseUtil,
        @inject("ProfileHelper") protected profileHelper: ProfileHelper,
        @inject("ProfileFixerService") protected profileFixerService: ProfileFixerService,
        @inject("LocalisationService") protected localisationService: LocalisationService,
        @inject("EventOutputHolder") protected eventOutputHolder: EventOutputHolder,
        @inject("PaymentService") protected paymentService: PaymentService,
        @inject("RepeatableQuestGenerator") protected repeatableQuestGenerator: RepeatableQuestGenerator,
        @inject("RepeatableQuestHelper") protected repeatableQuestHelper: RepeatableQuestHelper,
        @inject("QuestHelper") protected questHelper: QuestHelper,
        @inject("ConfigServer") protected configServer: ConfigServer,
        @inject("PrimaryCloner") protected cloner: ICloner
    )
    {
        super(logger, hashUtil, databaseService, timeUtil, randomUtil, httpResponse, profileHelper, profileFixerService, localisationService, eventOutputHolder, paymentService, repeatableQuestGenerator, repeatableQuestHelper, questHelper, configServer, cloner);
    }

    public customGenerateQuestPool(repeatableConfig: IRepeatableQuestConfig, pmcLevel: number): IQuestTypePool
    {
        return super.generateQuestPool(repeatableConfig, pmcLevel);
    }
}