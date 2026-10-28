export type DragonRace = 'light' | 'dark'

export type DragonStageNumber = 1 | 2 | 3 | 4 | 5 | 6

export type CurrentStageOption = 0 | 1 | 2 | 3 | 4 | 5

export type DragonProfessionCategory =
  | 'blacksmithing'
  | 'armorsmithing'
  | 'handicrafting'
  | 'alchemy'

export type DragonEquipmentCategory = 'weapon' | 'armor' | 'accessory'

export type DragonCategoryFilter =
  | 'all'
  | DragonEquipmentCategory
  | DragonProfessionCategory

export type AcquisitionMethod = 'Buy' | 'Craft'

export type ProcSkipsMap = Record<2 | 4 | 6, boolean>

export type OwnedMaterialsMap = Record<string, number>

export const DRAGON_STAGE_PREFIXES: Record<DragonRace, Record<DragonStageNumber, string>> = {
  light: {
    1: 'True Dragon Lord ',
    2: 'Splendent True Dragon Lord ',
    3: 'White Dragon Lord ',
    4: 'Splendent White Dragon Lord ',
    5: 'Wise Dragon Lord ',
    6: 'Splendent Wise Dragon Lord '
  },
  dark: {
    1: 'Star Dragon Lord ',
    2: 'Splendent Star Dragon Lord ',
    3: 'Dark Dragon Lord ',
    4: 'Splendent Dark Dragon Lord ',
    5: 'Ebony Dragon Lord ',
    6: 'Splendent Ebony Dragon Lord '
  }
}

export interface DragonConversionInput {
  id: string
  icon: string
  name: string
  grade: number
  dbType: string
  language: string
  quantity: number
  subCategory: string
  mainCategory: string
}

export interface DragonConversion {
  id: string
  inputs: DragonConversionInput[]
  profession: string
  successRate: number
  masteryLevel: number
  productQuantity: number
}

export interface DragonCraftableRecipeRef {
  id: string
  icon: string
  name: string
  grade: number
  dbType: string
  language: string
  subCategory: string
  mainCategory: string
}

export interface DragonRecipeInputItem {
  id: string
  icon: string
  name: string
  grade: number
  dbType: string
  language: string
  quantity: number
  conversions: DragonConversion[]
  subCategory: string
  enchantLevel: number | null
  mainCategory: string
  craftableRecipe: DragonCraftableRecipeRef | null
  replacementItem: DragonRecipeInputItem | null
}

export interface DragonProductItem {
  id: string
  icon: string
  name: string
  grade: number
  dbType: string
  language: string
  quantity: number
  subCategory: string
  mainCategory: string
}

export interface DragonRecipeOutputItems {
  productItem: DragonProductItem
  comboProbability: number | null
  comboProductItem: DragonProductItem | null
}

export interface DragonRecipe {
  id: string
  name: string
  icon: string
  grade: number
  dbType: string
  mainCategory: string
  subCategory?: string
  qualificationRace: DragonRace | string
  subTab?: string
  masteryGrade?: string
  masteryLevel?: number
  goldCost: number
  craftingFeeType?: string
  craftGauge: number
  successRates?: number[]
  learnType: string
  isGuildCraft: boolean
  recipeInputItems: DragonRecipeInputItem[]
  recipeOutputItems: DragonRecipeOutputItems
}

export interface DragonStageRecipe extends DragonRecipe {
  stage: DragonStageNumber
  prefix: string
  slot: string
  isSplendent: boolean
  comboProbability: number | null
  procRate: number
  recipe: DragonRecipe
}

export interface DragonSlotChain {
  key: string
  slot: string
  race: DragonRace
  factionName: 'Elyos' | 'Asmodian'
  equipmentCategory: DragonEquipmentCategory
  mainCategory: DragonProfessionCategory
  rawMainCategory: string
  subCategory: string
  subTab: string
  stages: Record<DragonStageNumber, DragonStageRecipe>
}

export type DragonChainsTree = Record<
  DragonRace,
  Record<string, Record<string, Record<string, DragonSlotChain>>>
>

export interface Server {
  serverId: number
  name: string
  region: string
  race: number
}

export interface MarketItem {
  id: number
  name: string
  icon: string
  grade: number
  mainCategory: string
  subCategory: string
}

export interface Listing {
  itemId: number
  minPrice: number
  listings: number
  updatedAt: string
  median7d: number
  change24h: number
  change7d: number
  listings24h?: number
  spark: number[]
}

export type NpcPrices = Record<string, number>

export interface ResolvedIngredient {
  id: string
  itemId: number
  name: string
  icon: string
  grade: number
  quantity: number
  ownedQuantity: number
  allocatedOwned: number
  remainingQuantity: number
  mainCategory: string
  subCategory: string
  isPrecursorEquipment: boolean
  buyPrice: number | null
  npcUnitPrice: number | null
  marketUnitPrice: number | null
  listingsCount: number | null
  craftPrice: number | null
  unitPrice: number
  totalCost: number
  remainingCost: number
  method: AcquisitionMethod
  acquisitionMethod: AcquisitionMethod
  isNpcSource: boolean
  isPriceMissing: boolean
  craftableRecipeId: string | null
  subIngredients: ResolvedIngredient[]
  unitSavings: number
}

export interface StageCalculationStep {
  stage: DragonStageNumber
  recipeId: string
  name: string
  prefix: string
  slot: string
  icon: string
  grade: number
  isSplendent: boolean
  comboProbability: number | null
  procRate: number
  comboProductItem: DragonProductItem | null
  productItem: DragonProductItem
  recipe: DragonStageRecipe
  isSkippable: boolean
  isSkipped: boolean
  ingredients: ResolvedIngredient[]
  excludedEquipmentItems: DragonRecipeInputItem[]
  goldCost: number
  materialCost: number
  remainingMaterialCost: number
  stageTotalCost: number
  remainingStageTotalCost: number
  effectiveCost: number
  potentialSavings: number
}

export interface TransferCalculationResult {
  chain: DragonSlotChain | null
  currentStage: CurrentStageOption
  targetStage: DragonStageNumber
  procSkips: ProcSkipsMap
  steps: StageCalculationStep[]
  activeSteps: StageCalculationStep[]
  skippedSteps: StageCalculationStep[]
  aggregatedMaterials: ResolvedIngredient[]
  expandedRawMaterials: ResolvedIngredient[]
  totalMaterialCost: number
  remainingMaterialCost: number
  totalGoldCost: number
  totalCostWithoutProcs: number
  expectedProcSavings: number
  expectedAverageCost: number
  totalProcSavings: number
  totalOwnedSavings: number
  totalCost: number
  targetItemMarketListing: Listing | null
  targetItemMarketPrice: number | null
}
