# Welcome to Repeatable Quest Config by acidphantasm

This mod is designed and built to be as easy as possible to use without breaking your game.

By default, without changing anything the ONLY thing that changes is all new Repeatable Quests will be of the type 'Elimination' only.

## **Configuration options**
### Multipliers
- xpMultiplier
  - Default: 1
  - Accepted Values: 0.01-5
    - Setting this multiplier changes the XP rewards for all repeatable quests by the amount you specify.
- currencyMultiplier
  - Default: 1
  - Accepted Values: 0.01-5
    - Setting this multiplier changes the Currency rewards for all repeatable quests by the amount you specify.
- repMultiplier
  - Default: 1
  - Accepted Values: 0.01-5
    - Setting this multiplier changes the Reputation rewards for all repeatable quests by the amount you specify.
- skillRewardChanceMultiplier
  - Default: 1
  - Accepted Values: 0.01-5
    - Setting this multiplier changes the chance you will have a skill reward for all repeatable quests.
- skillPointRewardMultiplier
  - Default: 1
  - Accepted Values: 0.01-5
    - Setting this multiplier changes the amount of Skill Points gained in rewards for all repeatable quests by the amount you specify.
### Specific Quest Types Only
- useSpecificQuestType
  - Default: true
    - Only ONE of useSpecificQuestType or useRandomQuestType can be true.
    - Setting this true will enforce all quests are only the type specified by one of the three below options.
- completionOnly
  - Default: false
    - Setting this true will enforce all quests are only of the 'Completion' type.
- explorationOnly
  - Default: false
    - Setting this true will enforce all quests are only of the 'Exploration' type.
- eliminationOnly
  - Default: true
    - Setting this true will enforce all quests are only of the 'Elimination' type.
### Random Select of Quest Types
- useRandomQuestType
  - Default: false
    - Only ONE of useSpecificQuestType or useRandomQuestType can be true.
    - Setting this true will enforce each quest type (Daily/Weekly/Scav) to be restricted to the options configured below.
    - All below values are the same as vanilla SPT.
- dailyTypes
  - Default: "Exploration", "Elimination", "Completion"
    - Remove one of the options to remove it from the available pool of quests for all Daily quests.
    - ENSURE that you are following the proper JSON format that is already in the config file. If you fail to do so, the server console will give you an error and not apply any changes.
- weeklyTypes
  - Default: "Exploration", "Elimination", "Completion"
    - Remove one of the options to remove it from the available pool of quests for all Weekly quests.
    - ENSURE that you are following the proper JSON format that is already in the config file. If you fail to do so, the server console will give you an error and not apply any changes.
- scavTypes
  - Default: "Exploration", "Elimination", "Completion"
    - Remove one of the options to remove it from the available pool of quests for all Scav quests.
    - ENSURE that you are following the proper JSON format that is already in the config file. If you fail to do so, the server console will give you an error and not apply any changes.
### Debug
- debugLogging
  - Default: false
    - Enable this option to see logging in the server console for any changes you have made to the config.