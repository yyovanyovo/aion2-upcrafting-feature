import { ref, computed, watch } from 'vue'
import {
  type DragonStageNumber,
  type CurrentStageOption,
  type ProcSkipsMap,
  type AcquisitionMethod,
  type DragonRecipe,
  type DragonRecipeInputItem,
  type DragonSlotChain,
  type Listing,
  type NpcPrices,
  type ResolvedIngredient,
  type StageCalculationStep,
  type TransferCalculationResult
} from '~/types/dragon'
import { useDragonChains } from '~/composables/useDragonChains'

const EQUIPMENT_MAIN_CATEGORIES = new Set(['weapon', 'armor', 'accessory'])

export interface IngredientResolutionContext {
  npcPrices: NpcPrices
  listingsMap: Map<number, Listing> | Record<string | number, Listing>
  allRecipesById: Map<string, DragonRecipe> | Record<string, DragonRecipe>
  itemProducerRecipeMap?: Map<number, DragonRecipe>
  counterpartChain?: DragonSlotChain | null
}

export interface CalculateTransferParams {
  chain: DragonSlotChain | null
  currentStage: CurrentStageOption
  targetStage: DragonStageNumber
  procSkips: ProcSkipsMap
  context: IngredientResolutionContext
}

export function isPrecursorEquipmentItem(item: DragonRecipeInputItem): boolean {
  if (!item) return false
  const mainCat = (item.mainCategory || '').toLowerCase().trim()
  if (EQUIPMENT_MAIN_CATEGORIES.has(mainCat)) {
    return true
  }

  const name = (item.name || '').trim()
  if (
    name.startsWith("Artisan's") &&
    mainCat !== 'misc' &&
    !name.toLowerCase().includes('refining stone')
  ) {
    return true
  }

  return false
}

export function filterStageInputItems(
  stage: DragonStageNumber,
  currentStage: CurrentStageOption,
  inputItems: DragonRecipeInputItem[] = []
): {
  included: DragonRecipeInputItem[]
  excluded: DragonRecipeInputItem[]
} {
  const included: DragonRecipeInputItem[] = []
  const excluded: DragonRecipeInputItem[] = []
  const includePrecursorGear = stage === 1 && currentStage === 0

  for (const item of inputItems) {
    if (!includePrecursorGear && isPrecursorEquipmentItem(item)) {
      excluded.push(item)
    } else {
      included.push(item)
    }
  }

  return { included, excluded }
}

function getListingForItem(
  itemId: string | number,
  listingsMap: Map<number, Listing> | Record<string | number, Listing>,
  allowPrecursorFallback = false
): Listing | undefined {
  const numId = Number(itemId)
  const strId = String(itemId)

  if (listingsMap instanceof Map) {
    const direct = listingsMap.get(numId) ?? (listingsMap as Map<any, Listing>).get(strId)
    if (direct !== undefined) return direct
    if (allowPrecursorFallback && Number.isFinite(numId)) {
      return listingsMap.get(numId + 1) ?? listingsMap.get(numId - 1)
    }
    return undefined
  }

  const recordDirect = listingsMap[strId] ?? listingsMap[numId]
  if (recordDirect !== undefined) return recordDirect
  if (allowPrecursorFallback && Number.isFinite(numId)) {
    return listingsMap[numId + 1] ?? listingsMap[numId - 1]
  }
  return undefined
}

function getRecipeById(
  recipeId: string | number | null | undefined,
  allRecipesById: Map<string, DragonRecipe> | Record<string, DragonRecipe>
): DragonRecipe | undefined {
  if (recipeId === null || recipeId === undefined) return undefined
  const key = String(recipeId)
  if (allRecipesById instanceof Map) {
    return allRecipesById.get(key)
  }
  return allRecipesById[key]
}

export function resolveIngredientCost(
  item: DragonRecipeInputItem,
  context: IngredientResolutionContext,
  visitedRecipes: Set<string> = new Set()
): ResolvedIngredient {
  const itemIdStr = String(item.id)
  const itemIdNum = Number(item.id)
  const isPrecursor = isPrecursorEquipmentItem(item)

  const rawNpcPrice = context.npcPrices?.[itemIdStr] ?? context.npcPrices?.[itemIdNum as any]
  const npcUnitPrice = typeof rawNpcPrice === 'number' && rawNpcPrice > 0 ? rawNpcPrice : null

  const listing = getListingForItem(item.id, context.listingsMap, isPrecursor)
  const marketUnitPrice =
    listing && typeof listing.minPrice === 'number' && listing.minPrice > 0
      ? listing.minPrice
      : null
  const listingsCount =
    listing && typeof listing.listings === 'number' ? listing.listings : null

  let buyPrice: number | null = null
  let isNpcSource = false

  if (npcUnitPrice !== null && marketUnitPrice !== null) {
    if (npcUnitPrice <= marketUnitPrice) {
      buyPrice = npcUnitPrice
      isNpcSource = true
    } else {
      buyPrice = marketUnitPrice
    }
  } else if (npcUnitPrice !== null) {
    buyPrice = npcUnitPrice
    isNpcSource = true
  } else if (marketUnitPrice !== null) {
    buyPrice = marketUnitPrice
  }

  const craftableRecipeId = item.craftableRecipe?.id ? String(item.craftableRecipe.id) : null
  let craftPrice: number | null = null
  const subIngredients: ResolvedIngredient[] = []

  if (craftableRecipeId && !visitedRecipes.has(craftableRecipeId)) {
    let subRecipe = getRecipeById(craftableRecipeId, context.allRecipesById)
    if (!subRecipe && context.itemProducerRecipeMap) {
      subRecipe = context.itemProducerRecipeMap.get(itemIdNum)
    }

    if (
      subRecipe &&
      Array.isArray(subRecipe.recipeInputItems) &&
      subRecipe.recipeInputItems.length > 0
    ) {
      const nextVisited = new Set(visitedRecipes)
      nextVisited.add(craftableRecipeId)

      let totalSubMaterialCost = 0
      let allSubInputsValid = true

      for (const subInput of subRecipe.recipeInputItems) {
        const resolvedSub = resolveIngredientCost(subInput, context, nextVisited)
        subIngredients.push(resolvedSub)
        if (resolvedSub.isPriceMissing) {
          allSubInputsValid = false
        }
        totalSubMaterialCost += resolvedSub.totalCost
      }

      const subGoldCost = typeof subRecipe.goldCost === 'number' ? subRecipe.goldCost : 0
      const outputQty =
        subRecipe.recipeOutputItems?.productItem?.quantity &&
        subRecipe.recipeOutputItems.productItem.quantity > 0
          ? subRecipe.recipeOutputItems.productItem.quantity
          : 1

      const computedCraftUnitCost = (totalSubMaterialCost + subGoldCost) / outputQty
      if (allSubInputsValid && computedCraftUnitCost > 0) {
        craftPrice = Math.round(computedCraftUnitCost)
      }
    }
  }

  let unitPrice = 0
  let method: AcquisitionMethod = 'Buy'
  let isPriceMissing = false
  let unitSavings = 0

  if (buyPrice !== null && craftPrice !== null) {
    if (craftPrice < buyPrice) {
      unitPrice = craftPrice
      method = 'Craft'
      unitSavings = buyPrice - craftPrice
    } else {
      unitPrice = buyPrice
      method = 'Buy'
      unitSavings = craftPrice - buyPrice
    }
  } else if (craftPrice !== null) {
    unitPrice = craftPrice
    method = 'Craft'
  } else if (buyPrice !== null) {
    unitPrice = buyPrice
    method = 'Buy'
  } else {
    isPriceMissing = true
  }

  const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
  const totalCost = unitPrice * quantity

  return {
    id: itemIdStr,
    itemId: itemIdNum,
    name: item.name,
    icon: item.icon,
    grade: item.grade,
    quantity,
    mainCategory: item.mainCategory || '',
    subCategory: item.subCategory || '',
    isPrecursorEquipment: isPrecursor,
    buyPrice,
    npcUnitPrice,
    marketUnitPrice,
    listingsCount,
    craftPrice,
    unitPrice,
    totalCost,
    method,
    acquisitionMethod: method,
    isNpcSource: method === 'Buy' && isNpcSource,
    isPriceMissing,
    craftableRecipeId,
    subIngredients,
    unitSavings
  }
}

export function isStageSkippable(
  stage: DragonStageNumber,
  currentStage: CurrentStageOption,
  targetStage: DragonStageNumber,
  chain?: DragonSlotChain | null
): boolean {
  if (stage !== 2 && stage !== 4 && stage !== 6) return false

  const precedingOddStage = (stage - 1) as DragonStageNumber
  const pathIncludesPair = precedingOddStage > currentStage && stage <= targetStage
  if (!pathIncludesPair) return false

  if (chain) {
    const prevRecipe = chain.stages[precedingOddStage]
    if (prevRecipe && prevRecipe.comboProbability !== 2500) {
      return false
    }
  }

  return true
}

export function calculateTransferPath(
  params: CalculateTransferParams
): TransferCalculationResult {
  const { chain, currentStage, targetStage, procSkips, context } = params

  if (!chain || targetStage <= currentStage) {
    return {
      chain,
      currentStage,
      targetStage,
      procSkips: { ...procSkips },
      steps: [],
      activeSteps: [],
      skippedSteps: [],
      aggregatedMaterials: [],
      expandedRawMaterials: [],
      totalMaterialCost: 0,
      totalGoldCost: 0,
      totalCostWithoutProcs: 0,
      expectedProcSavings: 0,
      expectedAverageCost: 0,
      totalProcSavings: 0,
      totalCost: 0,
      targetItemMarketListing: null,
      targetItemMarketPrice: null
    }
  }

  const steps: StageCalculationStep[] = []
  const ALL_STAGES: DragonStageNumber[] = [1, 2, 3, 4, 5, 6]

  for (const stageNum of ALL_STAGES) {
    if (stageNum <= currentStage || stageNum > targetStage) continue

    const stageRecipe = chain.stages[stageNum]
    if (!stageRecipe) continue

    const { included, excluded } = filterStageInputItems(
      stageNum,
      currentStage,
      stageRecipe.recipeInputItems || []
    )

    const resolvedIngredients = included.map((ing) =>
      resolveIngredientCost(ing, context)
    )

    const materialCost = resolvedIngredients.reduce((sum, ing) => sum + ing.totalCost, 0)
    const goldCost = typeof stageRecipe.goldCost === 'number' ? stageRecipe.goldCost : 0
    const stageTotalCost = materialCost + goldCost

    const skippable = isStageSkippable(stageNum, currentStage, targetStage, chain)
    const skipped =
      skippable &&
      (stageNum === 2 || stageNum === 4 || stageNum === 6) &&
      Boolean(procSkips[stageNum])

    steps.push({
      stage: stageNum,
      recipeId: stageRecipe.id,
      name: stageRecipe.name,
      prefix: stageRecipe.prefix,
      slot: stageRecipe.slot,
      icon: stageRecipe.icon,
      grade: stageRecipe.grade,
      isSplendent: stageRecipe.isSplendent,
      comboProbability: stageRecipe.comboProbability,
      procRate: stageRecipe.procRate,
      comboProductItem: stageRecipe.recipeOutputItems?.comboProductItem ?? null,
      productItem: stageRecipe.recipeOutputItems.productItem,
      recipe: stageRecipe,
      isSkippable: skippable,
      isSkipped: skipped,
      ingredients: resolvedIngredients,
      excludedEquipmentItems: excluded,
      goldCost,
      materialCost,
      stageTotalCost,
      effectiveCost: skipped ? 0 : stageTotalCost,
      potentialSavings: stageTotalCost
    })
  }

  const activeSteps = steps.filter((s) => !s.isSkipped)
  const skippedSteps = steps.filter((s) => s.isSkipped)

  const aggregatedMap = new Map<string, ResolvedIngredient>()
  const expandedRawMap = new Map<string, ResolvedIngredient>()

  for (const step of activeSteps) {
    for (const ing of step.ingredients) {
      const existing = aggregatedMap.get(ing.id)
      if (existing) {
        existing.quantity += ing.quantity
        existing.totalCost = existing.unitPrice * existing.quantity
      } else {
        aggregatedMap.set(ing.id, {
          ...ing,
          subIngredients: ing.subIngredients.map((sub) => ({ ...sub }))
        })
      }

      if (ing.method === 'Craft' && ing.subIngredients.length > 0) {
        for (const sub of ing.subIngredients) {
          const neededSubQty = sub.quantity * ing.quantity
          const existingRaw = expandedRawMap.get(sub.id)
          if (existingRaw) {
            existingRaw.quantity += neededSubQty
            existingRaw.totalCost = existingRaw.unitPrice * existingRaw.quantity
          } else {
            expandedRawMap.set(sub.id, {
              ...sub,
              quantity: neededSubQty,
              totalCost: sub.unitPrice * neededSubQty
            })
          }
        }
      } else {
        const existingRaw = expandedRawMap.get(ing.id)
        if (existingRaw) {
          existingRaw.quantity += ing.quantity
          existingRaw.totalCost = existingRaw.unitPrice * existingRaw.quantity
        } else {
          expandedRawMap.set(ing.id, {
            ...ing,
            subIngredients: ing.subIngredients.map((sub) => ({ ...sub }))
          })
        }
      }
    }
  }

  const totalCostWithoutProcs = steps.reduce((sum, s) => sum + s.stageTotalCost, 0)
  const expectedProcSavings = Math.round(
    steps
      .filter((s) => s.isSkippable)
      .reduce((sum, s) => sum + s.stageTotalCost * 0.25, 0)
  )
  const expectedAverageCost = Math.max(0, totalCostWithoutProcs - expectedProcSavings)
  const totalMaterialCost = activeSteps.reduce((sum, s) => sum + s.materialCost, 0)
  const totalGoldCost = activeSteps.reduce((sum, s) => sum + s.goldCost, 0)
  const totalCost = activeSteps.reduce((sum, s) => sum + s.effectiveCost, 0)
  const totalProcSavings = skippedSteps.reduce((sum, s) => sum + s.stageTotalCost, 0)

  let targetItemMarketListing: Listing | null = null
  const candidateItemIds: (string | number)[] = []

  const targetRecipe = chain.stages[targetStage]
  if (targetRecipe?.recipeOutputItems?.productItem?.id) {
    candidateItemIds.push(targetRecipe.recipeOutputItems.productItem.id)
  }
  if (targetStage % 2 === 0) {
    const prevOdd = chain.stages[(targetStage - 1) as DragonStageNumber]
    if (prevOdd?.recipeOutputItems?.comboProductItem?.id) {
      candidateItemIds.push(prevOdd.recipeOutputItems.comboProductItem.id)
    }
  }
  if (context.counterpartChain) {
    const cpTarget = context.counterpartChain.stages[targetStage]
    if (cpTarget?.recipeOutputItems?.productItem?.id) {
      candidateItemIds.push(cpTarget.recipeOutputItems.productItem.id)
    }
    if (targetStage % 2 === 0) {
      const cpPrevOdd = context.counterpartChain.stages[(targetStage - 1) as DragonStageNumber]
      if (cpPrevOdd?.recipeOutputItems?.comboProductItem?.id) {
        candidateItemIds.push(cpPrevOdd.recipeOutputItems.comboProductItem.id)
      }
    }
  }

  for (const cid of candidateItemIds) {
    const found = getListingForItem(cid, context.listingsMap, false)
    if (found && typeof found.minPrice === 'number' && found.minPrice > 0) {
      targetItemMarketListing = found
      break
    }
  }

  return {
    chain,
    currentStage,
    targetStage,
    procSkips: { ...procSkips },
    steps,
    activeSteps,
    skippedSteps,
    aggregatedMaterials: Array.from(aggregatedMap.values()),
    expandedRawMaterials: Array.from(expandedRawMap.values()),
    totalMaterialCost,
    totalGoldCost,
    totalCostWithoutProcs,
    expectedProcSavings,
    expectedAverageCost,
    totalProcSavings,
    totalCost,
    targetItemMarketListing,
    targetItemMarketPrice: targetItemMarketListing ? targetItemMarketListing.minPrice : null
  }
}

const currentStage = ref<CurrentStageOption>(0)
const targetStage = ref<DragonStageNumber>(6)
const procSkips = ref<ProcSkipsMap>({
  2: false,
  4: false,
  6: false
})

export const useTransferCalculator = () => {
  const dragonChains = useDragonChains()

  watch(currentStage, (newCurrent) => {
    if (targetStage.value <= newCurrent) {
      targetStage.value = Math.min(6, newCurrent + 1) as DragonStageNumber
    }
  })

  watch(targetStage, (newTarget) => {
    if (newTarget <= currentStage.value) {
      currentStage.value = Math.max(0, newTarget - 1) as CurrentStageOption
    }
  })

  const setCurrentStage = (stage: CurrentStageOption) => {
    const clamped = Math.max(0, Math.min(5, stage)) as CurrentStageOption
    currentStage.value = clamped
    if (targetStage.value <= clamped) {
      targetStage.value = Math.min(6, clamped + 1) as DragonStageNumber
    }
  }

  const setTargetStage = (stage: DragonStageNumber) => {
    const clamped = Math.max(1, Math.min(6, stage)) as DragonStageNumber
    targetStage.value = clamped
    if (currentStage.value >= clamped) {
      currentStage.value = Math.max(0, clamped - 1) as CurrentStageOption
    }
  }

  const toggleProcSkip = (stage: 2 | 4 | 6) => {
    procSkips.value = {
      ...procSkips.value,
      [stage]: !procSkips.value[stage]
    }
  }

  const setProcSkip = (stage: 2 | 4 | 6, value: boolean) => {
    procSkips.value = {
      ...procSkips.value,
      [stage]: Boolean(value)
    }
  }

  const resetProcSkips = () => {
    procSkips.value = {
      2: false,
      4: false,
      6: false
    }
  }

  const calculation = computed<TransferCalculationResult>(() => {
    const oppositeRace = dragonChains.selectedRace.value === 'light' ? 'dark' : 'light'
    const counterpartChain = dragonChains.getChain(oppositeRace, dragonChains.selectedSlot.value)

    return calculateTransferPath({
      chain: dragonChains.activeChain.value,
      currentStage: currentStage.value,
      targetStage: targetStage.value,
      procSkips: procSkips.value,
      context: {
        npcPrices: dragonChains.npcPrices.value,
        listingsMap: dragonChains.listingsMap.value,
        allRecipesById: dragonChains.allRecipesById.value,
        itemProducerRecipeMap: dragonChains.itemProducerRecipeMap.value,
        counterpartChain
      }
    })
  })

  const steps = computed(() => calculation.value.steps)
  const activeSteps = computed(() => calculation.value.activeSteps)
  const skippedSteps = computed(() => calculation.value.skippedSteps)
  const aggregatedMaterials = computed(() => calculation.value.aggregatedMaterials)
  const expandedRawMaterials = computed(() => calculation.value.expandedRawMaterials)
  const totalMaterialCost = computed(() => calculation.value.totalMaterialCost)
  const totalGoldCost = computed(() => calculation.value.totalGoldCost)
  const totalCostWithoutProcs = computed(() => calculation.value.totalCostWithoutProcs)
  const expectedProcSavings = computed(() => calculation.value.expectedProcSavings)
  const expectedAverageCost = computed(() => calculation.value.expectedAverageCost)
  const totalProcSavings = computed(() => calculation.value.totalProcSavings)
  const totalCost = computed(() => calculation.value.totalCost)
  const targetItemMarketListing = computed(() => calculation.value.targetItemMarketListing)
  const targetItemMarketPrice = computed(() => calculation.value.targetItemMarketPrice)

  const skippableStages = computed<Record<2 | 4 | 6, boolean>>(() => ({
    2: isStageSkippable(2, currentStage.value, targetStage.value, dragonChains.activeChain.value),
    4: isStageSkippable(4, currentStage.value, targetStage.value, dragonChains.activeChain.value),
    6: isStageSkippable(6, currentStage.value, targetStage.value, dragonChains.activeChain.value)
  }))

  return {
    currentStage,
    targetStage,
    procSkips,
    skippableStages,
    setCurrentStage,
    setTargetStage,
    toggleProcSkip,
    setProcSkip,
    resetProcSkips,
    calculation,
    steps,
    activeSteps,
    skippedSteps,
    aggregatedMaterials,
    expandedRawMaterials,
    totalMaterialCost,
    totalGoldCost,
    totalCostWithoutProcs,
    expectedProcSavings,
    expectedAverageCost,
    totalProcSavings,
    totalCost,
    targetItemMarketListing,
    targetItemMarketPrice,
    isPrecursorEquipmentItem,
    filterStageInputItems,
    resolveIngredientCost,
    isStageSkippable,
    calculateTransferPath
  }
}
