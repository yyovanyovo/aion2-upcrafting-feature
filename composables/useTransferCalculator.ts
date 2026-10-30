import { ref, computed, watch } from 'vue'
import {
  type DragonStageNumber,
  type CurrentStageOption,
  type ProcSkipsMap,
  type OwnedMaterialsMap,
  type AcquisitionMethod,
  type DragonRecipe,
  type DragonRecipeInputItem,
  type DragonSlotChain,
  type Listing,
  type NpcPrices,
  type RawMaterialCraftTarget,
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
  forceCraftSubMaterials?: boolean
}

export interface CalculateTransferParams {
  chain: DragonSlotChain | null
  currentStage: CurrentStageOption
  targetStage: DragonStageNumber
  procSkips: ProcSkipsMap
  ownedMaterials?: OwnedMaterialsMap
  forceCraftSubMaterials?: boolean
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
  const isBuyCheaperThanCraft =
    subIngredients.length > 0 && buyPrice !== null && craftPrice !== null && buyPrice < craftPrice

  if (buyPrice !== null && craftPrice !== null) {
    if (context.forceCraftSubMaterials || craftPrice <= buyPrice) {
      unitPrice = craftPrice
      method = 'Craft'
      unitSavings = Math.max(0, buyPrice - craftPrice)
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
    perCraftQuantity: quantity,
    ownedQuantity: 0,
    allocatedOwned: 0,
    rawAllocatedOwned: 0,
    allocatedFromParentCrafts: 0,
    craftableFromRaw: 0,
    rawCostSavings: 0,
    remainingQuantity: quantity,
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
    remainingCost: totalCost,
    method,
    acquisitionMethod: method,
    isBuyCheaperThanCraft,
    isNpcSource: method === 'Buy' && isNpcSource,
    isPriceMissing,
    craftableRecipeId,
    subIngredients,
    usedForCrafts: [],
    stages: [],
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

export function makeStageOwnedKey(stage: number, itemId: string | number): string {
  return `${stage}:${itemId}`
}

export function makeRawOwnedKey(itemId: string | number): string {
  return `raw:${itemId}`
}

export function calculateTransferPath(
  params: CalculateTransferParams
): TransferCalculationResult {
  const {
    chain,
    currentStage,
    targetStage,
    procSkips,
    ownedMaterials = {},
    forceCraftSubMaterials = false,
    context
  } = params

  const effectiveContext: IngredientResolutionContext = {
    ...context,
    forceCraftSubMaterials: forceCraftSubMaterials || Boolean(context.forceCraftSubMaterials)
  }

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
      remainingMaterialCost: 0,
      totalGoldCost: 0,
      totalCostWithoutProcs: 0,
      expectedProcSavings: 0,
      expectedAverageCost: 0,
      totalProcSavings: 0,
      totalOwnedSavings: 0,
      totalCost: 0,
      targetItemMarketListing: null,
      targetItemMarketPrice: null
    }
  }

  const steps: StageCalculationStep[] = []
  const ALL_STAGES: DragonStageNumber[] = [1, 2, 3, 4, 5, 6]
  const rawPool = new Map<string, number>()

  const getRawAvailable = (rawId: string): number => {
    if (!rawPool.has(rawId)) {
      const rawKey = makeRawOwnedKey(rawId)
      const initial = Math.max(0, Math.floor(Number(ownedMaterials[rawKey]) || 0))
      rawPool.set(rawId, initial)
    }
    return rawPool.get(rawId) || 0
  }

  for (const stageNum of ALL_STAGES) {
    if (stageNum <= currentStage || stageNum > targetStage) continue

    const stageRecipe = chain.stages[stageNum]
    if (!stageRecipe) continue

    const { included, excluded } = filterStageInputItems(
      stageNum,
      currentStage,
      stageRecipe.recipeInputItems || []
    )

    const skippable = isStageSkippable(stageNum, currentStage, targetStage, chain)
    const skipped =
      skippable &&
      (stageNum === 2 || stageNum === 4 || stageNum === 6) &&
      Boolean(procSkips[stageNum])

    const resolvedIngredients = included.map((ing) => {
      const base = resolveIngredientCost(ing, effectiveContext)
      const stageKey = makeStageOwnedKey(stageNum, base.id)
      const stageOwned = Math.max(0, Math.floor(Number(ownedMaterials[stageKey]) || 0))
      const allocated = skipped ? 0 : Math.min(base.quantity, stageOwned)
      const remainingQty = skipped ? base.quantity : Math.max(0, base.quantity - allocated)
      const remainingCost = remainingQty * base.unitPrice

      let stepSubIngredients = base.subIngredients.map((sub) => {
        const perCraftQty = sub.perCraftQuantity ?? sub.quantity
        const totalSubQty = perCraftQty * base.quantity
        const coveredByParentOwned = skipped ? 0 : perCraftQty * allocated
        const remainingSubQty = skipped ? totalSubQty : Math.max(0, totalSubQty - coveredByParentOwned)

        return {
          ...sub,
          perCraftQuantity: perCraftQty,
          quantity: totalSubQty,
          ownedQuantity: coveredByParentOwned,
          allocatedOwned: coveredByParentOwned,
          rawAllocatedOwned: 0,
          allocatedFromParentCrafts: coveredByParentOwned,
          remainingQuantity: remainingSubQty,
          totalCost: sub.unitPrice * totalSubQty,
          remainingCost: sub.unitPrice * remainingSubQty,
          stages: [stageNum]
        }
      })

      return {
        ...base,
        ownedQuantity: stageOwned,
        allocatedOwned: allocated,
        craftableFromRaw: 0,
        rawCostSavings: 0,
        remainingQuantity: remainingQty,
        remainingCost,
        subIngredients: stepSubIngredients,
        stages: [stageNum]
      }
    })

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
      goldCost: typeof stageRecipe.goldCost === 'number' ? stageRecipe.goldCost : 0,
      materialCost: 0,
      remainingMaterialCost: 0,
      stageTotalCost: 0,
      remainingStageTotalCost: 0,
      effectiveCost: 0,
      potentialSavings: 0
    })
  }

  // Pass 1: Allocate rawPool to active ingredients where method === 'Craft'
  for (const step of steps) {
    if (step.isSkipped) continue
    for (const ing of step.ingredients) {
      if (ing.method === 'Craft' && ing.subIngredients.length > 0) {
        for (const sub of ing.subIngredients) {
          const perCraftQty = sub.perCraftQuantity ?? 1
          const neededForRemaining = perCraftQty * ing.remainingQuantity
          const availRaw = getRawAvailable(sub.id)
          const allocatedFromRaw = Math.min(neededForRemaining, availRaw)

          if (allocatedFromRaw > 0) {
            rawPool.set(sub.id, availRaw - allocatedFromRaw)
          }

          const totalSubAllocated = (sub.allocatedFromParentCrafts || 0) + allocatedFromRaw
          const remainingSubQty = Math.max(0, sub.quantity - totalSubAllocated)

          sub.rawAllocatedOwned = allocatedFromRaw
          sub.allocatedOwned = totalSubAllocated
          sub.ownedQuantity = totalSubAllocated
          sub.remainingQuantity = remainingSubQty
          sub.remainingCost = sub.unitPrice * remainingSubQty
        }

        ing.craftableFromRaw =
          ing.remainingQuantity > 0
            ? Math.min(
                ing.remainingQuantity,
                ...ing.subIngredients.map((s) =>
                  Math.floor((s.rawAllocatedOwned || 0) / (s.perCraftQuantity || 1))
                )
              )
            : 0

        ing.rawCostSavings = Math.min(
          ing.remainingCost,
          ing.subIngredients.reduce(
            (sum, s) => sum + (s.rawAllocatedOwned || 0) * s.unitPrice,
            0
          )
        )

        ing.remainingCost = Math.max(0, ing.remainingCost - ing.rawCostSavings)
      }
    }
  }

  // Pass 2: Smart Buy -> Craft switch for Buy-cheaper items when user owns raw materials that make crafting cheaper than buying
  for (const step of steps) {
    if (step.isSkipped) continue
    for (const ing of step.ingredients) {
      if (ing.method === 'Buy' && ing.subIngredients.length > 0 && ing.remainingQuantity > 0) {
        const hasAnyRawInPool = ing.subIngredients.some((s) => getRawAvailable(s.id) > 0)
        if (!hasAnyRawInPool) continue

        const unitCraftCost = ing.craftPrice ?? ing.subIngredients.reduce(
          (sum, s) => sum + (s.perCraftQuantity || 1) * s.unitPrice,
          0
        )

        let unitsSwitchedToCraft = 0
        let unitsFullyCraftable = 0
        let totalSavingsVsBuy = 0
        const allocatedPerSub = new Map<string, number>()

        for (let u = 0; u < ing.remainingQuantity; u++) {
          let rawValForUnit = 0
          let allSubsCoveredForUnit = true
          const unitTake = new Map<string, number>()

          for (const sub of ing.subIngredients) {
            const perCraft = sub.perCraftQuantity ?? 1
            const avail = getRawAvailable(sub.id) - (allocatedPerSub.get(sub.id) || 0)
            const take = Math.max(0, Math.min(perCraft, avail))
            unitTake.set(sub.id, take)
            rawValForUnit += take * sub.unitPrice
            if (take < perCraft) {
              allSubsCoveredForUnit = false
            }
          }

          const effectiveUnitCraftCost = Math.max(0, unitCraftCost - rawValForUnit)
          if (rawValForUnit > 0 && effectiveUnitCraftCost < ing.unitPrice) {
            unitsSwitchedToCraft++
            if (allSubsCoveredForUnit) {
              unitsFullyCraftable++
            }
            totalSavingsVsBuy += ing.unitPrice - effectiveUnitCraftCost
            for (const [subId, take] of unitTake.entries()) {
              if (take > 0) {
                allocatedPerSub.set(subId, (allocatedPerSub.get(subId) || 0) + take)
              }
            }
          } else {
            break
          }
        }

        if (unitsSwitchedToCraft > 0) {
          for (const sub of ing.subIngredients) {
            const allocatedFromRaw = allocatedPerSub.get(sub.id) || 0
            if (allocatedFromRaw > 0) {
              const avail = getRawAvailable(sub.id)
              rawPool.set(sub.id, Math.max(0, avail - allocatedFromRaw))
            }
            const totalSubAllocated = (sub.allocatedFromParentCrafts || 0) + allocatedFromRaw
            const remainingSubQty = Math.max(0, sub.quantity - totalSubAllocated)
            sub.rawAllocatedOwned = allocatedFromRaw
            sub.allocatedOwned = totalSubAllocated
            sub.ownedQuantity = totalSubAllocated
            sub.remainingQuantity = remainingSubQty
            sub.remainingCost = sub.unitPrice * remainingSubQty
          }

          ing.craftableFromRaw = unitsFullyCraftable
          ing.rawCostSavings = Math.min(ing.remainingCost, totalSavingsVsBuy)
          ing.remainingCost = Math.max(0, ing.remainingCost - ing.rawCostSavings)

          if (unitsSwitchedToCraft === ing.remainingQuantity) {
            ing.method = 'Craft'
            ing.acquisitionMethod = 'Craft'
          }
        }
      }
    }
  }

  for (const step of steps) {
    step.materialCost = step.ingredients.reduce((sum, ing) => sum + ing.totalCost, 0)
    step.remainingMaterialCost = step.ingredients.reduce((sum, ing) => sum + ing.remainingCost, 0)
    step.stageTotalCost = step.materialCost + step.goldCost
    step.remainingStageTotalCost = step.remainingMaterialCost + step.goldCost
    step.effectiveCost = step.isSkipped ? 0 : step.remainingStageTotalCost
    step.potentialSavings = step.stageTotalCost
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
        existing.ownedQuantity += ing.allocatedOwned
        existing.allocatedOwned += ing.allocatedOwned
        existing.craftableFromRaw = (existing.craftableFromRaw || 0) + (ing.craftableFromRaw || 0)
        existing.rawCostSavings = (existing.rawCostSavings || 0) + (ing.rawCostSavings || 0)
        existing.remainingQuantity += ing.remainingQuantity
        existing.totalCost += ing.totalCost
        existing.remainingCost += ing.remainingCost
        if (ing.method === 'Craft') {
          existing.method = 'Craft'
          existing.acquisitionMethod = 'Craft'
        }
        if (existing.stages && !existing.stages.includes(step.stage)) {
          existing.stages.push(step.stage)
        }

        if (ing.subIngredients.length > 0) {
          for (const sub of ing.subIngredients) {
            const existingSub = existing.subIngredients.find((s) => s.id === sub.id)
            if (existingSub) {
              existingSub.quantity += sub.quantity
              existingSub.ownedQuantity += sub.allocatedOwned
              existingSub.allocatedOwned += sub.allocatedOwned
              existingSub.rawAllocatedOwned =
                (existingSub.rawAllocatedOwned || 0) + (sub.rawAllocatedOwned || 0)
              existingSub.allocatedFromParentCrafts =
                (existingSub.allocatedFromParentCrafts || 0) +
                (sub.allocatedFromParentCrafts || 0)
              existingSub.remainingQuantity += sub.remainingQuantity
              existingSub.totalCost += sub.totalCost
              existingSub.remainingCost += sub.remainingCost
              if (existingSub.stages && !existingSub.stages.includes(step.stage)) {
                existingSub.stages.push(step.stage)
              }
            } else {
              existing.subIngredients.push({
                ...sub,
                stages: [...(sub.stages || [step.stage])]
              })
            }
          }
        }
      } else {
        aggregatedMap.set(ing.id, {
          ...ing,
          ownedQuantity: ing.allocatedOwned,
          totalCost: ing.totalCost,
          remainingCost: ing.remainingCost,
          stages: [step.stage],
          subIngredients: ing.subIngredients.map((sub) => ({
            ...sub,
            stages: [...(sub.stages || [step.stage])]
          }))
        })
      }

      if (ing.method === 'Craft' && ing.subIngredients.length > 0) {
        for (const sub of ing.subIngredients) {
          const perCraftQty = sub.perCraftQuantity ?? 1
          const existingRaw = expandedRawMap.get(sub.id)
          const craftTargets: RawMaterialCraftTarget[] = existingRaw?.usedForCrafts
            ? [...existingRaw.usedForCrafts]
            : []

          const existingTarget = craftTargets.find((t) => t.parentItemId === ing.id)
          if (existingTarget) {
            if (!existingTarget.stages.includes(step.stage)) {
              existingTarget.stages.push(step.stage)
            }
            existingTarget.parentTotalQuantity += ing.quantity
            existingTarget.parentOwnedQuantity += ing.allocatedOwned
            existingTarget.parentRemainingToCraft += ing.remainingQuantity
            existingTarget.parentCraftableFromRaw += ing.craftableFromRaw || 0
            existingTarget.rawTotalQuantity += sub.quantity
            existingTarget.rawRequiredQuantity +=
              sub.quantity - (sub.allocatedFromParentCrafts || 0)
            existingTarget.rawAllocatedOwned += sub.rawAllocatedOwned || 0
            existingTarget.rawRemainingQuantity += sub.remainingQuantity
          } else {
            craftTargets.push({
              parentItemId: ing.id,
              parentName: ing.name,
              parentIcon: ing.icon,
              parentGrade: ing.grade,
              stages: [step.stage],
              parentTotalQuantity: ing.quantity,
              parentOwnedQuantity: ing.allocatedOwned,
              parentRemainingToCraft: ing.remainingQuantity,
              parentCraftableFromRaw: ing.craftableFromRaw || 0,
              rawPerParent: perCraftQty,
              rawTotalQuantity: sub.quantity,
              rawRequiredQuantity: sub.quantity - (sub.allocatedFromParentCrafts || 0),
              rawAllocatedOwned: sub.rawAllocatedOwned || 0,
              rawRemainingQuantity: sub.remainingQuantity
            })
          }

          if (existingRaw) {
            existingRaw.quantity += sub.quantity
            existingRaw.ownedQuantity += sub.allocatedOwned
            existingRaw.allocatedOwned += sub.allocatedOwned
            existingRaw.rawAllocatedOwned =
              (existingRaw.rawAllocatedOwned || 0) + (sub.rawAllocatedOwned || 0)
            existingRaw.allocatedFromParentCrafts =
              (existingRaw.allocatedFromParentCrafts || 0) + (sub.allocatedFromParentCrafts || 0)
            existingRaw.remainingQuantity += sub.remainingQuantity
            existingRaw.totalCost = existingRaw.unitPrice * existingRaw.quantity
            existingRaw.remainingCost = existingRaw.unitPrice * existingRaw.remainingQuantity
            existingRaw.usedForCrafts = craftTargets
            if (existingRaw.stages && !existingRaw.stages.includes(step.stage)) {
              existingRaw.stages.push(step.stage)
            }
          } else {
            expandedRawMap.set(sub.id, {
              ...sub,
              quantity: sub.quantity,
              ownedQuantity: sub.allocatedOwned,
              allocatedOwned: sub.allocatedOwned,
              rawAllocatedOwned: sub.rawAllocatedOwned || 0,
              allocatedFromParentCrafts: sub.allocatedFromParentCrafts || 0,
              remainingQuantity: sub.remainingQuantity,
              totalCost: sub.unitPrice * sub.quantity,
              remainingCost: sub.unitPrice * sub.remainingQuantity,
              usedForCrafts: craftTargets,
              stages: [step.stage]
            })
          }
        }
      } else {
        const existingRaw = expandedRawMap.get(ing.id)
        if (existingRaw) {
          existingRaw.quantity += ing.quantity
          existingRaw.ownedQuantity += ing.allocatedOwned
          existingRaw.allocatedOwned += ing.allocatedOwned
          existingRaw.craftableFromRaw =
            (existingRaw.craftableFromRaw || 0) + (ing.craftableFromRaw || 0)
          existingRaw.rawCostSavings =
            (existingRaw.rawCostSavings || 0) + (ing.rawCostSavings || 0)
          existingRaw.remainingQuantity += ing.remainingQuantity
          existingRaw.totalCost += ing.totalCost
          existingRaw.remainingCost += ing.remainingCost
          if (existingRaw.stages && !existingRaw.stages.includes(step.stage)) {
            existingRaw.stages.push(step.stage)
          }
          if (ing.subIngredients.length > 0) {
            for (const sub of ing.subIngredients) {
              const existingSub = existingRaw.subIngredients.find((s) => s.id === sub.id)
              if (existingSub) {
                existingSub.quantity += sub.quantity
                existingSub.ownedQuantity += sub.allocatedOwned
                existingSub.allocatedOwned += sub.allocatedOwned
                existingSub.rawAllocatedOwned =
                  (existingSub.rawAllocatedOwned || 0) + (sub.rawAllocatedOwned || 0)
                existingSub.allocatedFromParentCrafts =
                  (existingSub.allocatedFromParentCrafts || 0) +
                  (sub.allocatedFromParentCrafts || 0)
                existingSub.remainingQuantity += sub.remainingQuantity
                existingSub.totalCost += sub.totalCost
                existingSub.remainingCost += sub.remainingCost
              } else {
                existingRaw.subIngredients.push({ ...sub })
              }
            }
          }
        } else {
          expandedRawMap.set(ing.id, {
            ...ing,
            ownedQuantity: ing.allocatedOwned,
            totalCost: ing.totalCost,
            remainingCost: ing.remainingCost,
            stages: [step.stage],
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
  const remainingMaterialCost = activeSteps.reduce((sum, s) => sum + s.remainingMaterialCost, 0)
  const totalGoldCost = activeSteps.reduce((sum, s) => sum + s.goldCost, 0)
  const totalOwnedSavings = Math.max(0, totalMaterialCost - remainingMaterialCost)
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
    remainingMaterialCost,
    totalGoldCost,
    totalCostWithoutProcs,
    expectedProcSavings,
    expectedAverageCost,
    totalProcSavings,
    totalOwnedSavings,
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
const ownedMaterials = ref<OwnedMaterialsMap>({})
const forceCraftSubMaterials = ref<boolean>(false)

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

  const toggleForceCraftSubMaterials = () => {
    forceCraftSubMaterials.value = !forceCraftSubMaterials.value
  }

  const getStageOwnedMaterial = (stage: number, itemId: string | number): number => {
    const key = makeStageOwnedKey(stage, itemId)
    return Math.max(0, Math.floor(Number(ownedMaterials.value[key]) || 0))
  }

  const setStageOwnedMaterial = (
    stage: number,
    itemId: string | number,
    count: number | string,
    maxQuantity?: number
  ) => {
    const key = makeStageOwnedKey(stage, itemId)
    let parsed = Math.max(0, Math.floor(Number(count) || 0))
    if (typeof maxQuantity === 'number' && maxQuantity > 0) {
      parsed = Math.min(maxQuantity, parsed)
    }
    const next = { ...ownedMaterials.value }
    if (parsed <= 0) {
      delete next[key]
    } else {
      next[key] = parsed
    }
    ownedMaterials.value = next
  }

  const setTotalOwnedMaterial = (
    itemId: string | number,
    totalCount: number | string,
    maxQuantity?: number
  ) => {
    const idStr = String(itemId)
    let remainingToDistribute = Math.max(0, Math.floor(Number(totalCount) || 0))
    if (typeof maxQuantity === 'number' && maxQuantity >= 0) {
      remainingToDistribute = Math.min(maxQuantity, remainingToDistribute)
    }

    const next = { ...ownedMaterials.value }
    let matchedDirectStage = false

    for (const step of calculation.value.steps) {
      const stageKey = makeStageOwnedKey(step.stage, idStr)
      if (step.isSkipped) {
        delete next[stageKey]
        continue
      }

      const ing = step.ingredients.find((i) => i.id === idStr)
      if (!ing) continue

      matchedDirectStage = true
      const allocate = Math.min(ing.quantity, remainingToDistribute)
      remainingToDistribute -= allocate

      if (allocate <= 0) {
        delete next[stageKey]
      } else {
        next[stageKey] = allocate
      }
    }

    if (!matchedDirectStage) {
      const rawKey = makeRawOwnedKey(idStr)
      if (remainingToDistribute <= 0) {
        delete next[rawKey]
      } else {
        next[rawKey] = remainingToDistribute
      }
    }

    ownedMaterials.value = next
  }

  const resetOwnedMaterials = () => {
    ownedMaterials.value = {}
  }

  const hasOwnedMaterials = computed<boolean>(() => {
    return Object.values(ownedMaterials.value).some((v) => v > 0)
  })

  const calculation = computed<TransferCalculationResult>(() => {
    const oppositeRace = dragonChains.selectedRace.value === 'light' ? 'dark' : 'light'
    const counterpartChain = dragonChains.getChain(oppositeRace, dragonChains.selectedSlot.value)

    return calculateTransferPath({
      chain: dragonChains.activeChain.value,
      currentStage: currentStage.value,
      targetStage: targetStage.value,
      procSkips: procSkips.value,
      ownedMaterials: ownedMaterials.value,
      forceCraftSubMaterials: forceCraftSubMaterials.value,
      context: {
        npcPrices: dragonChains.npcPrices.value,
        listingsMap: dragonChains.listingsMap.value,
        allRecipesById: dragonChains.allRecipesById.value,
        itemProducerRecipeMap: dragonChains.itemProducerRecipeMap.value,
        counterpartChain,
        forceCraftSubMaterials: forceCraftSubMaterials.value
      }
    })
  })

  const steps = computed(() => calculation.value.steps)
  const activeSteps = computed(() => calculation.value.activeSteps)
  const skippedSteps = computed(() => calculation.value.skippedSteps)
  const aggregatedMaterials = computed(() => calculation.value.aggregatedMaterials)
  const expandedRawMaterials = computed(() => calculation.value.expandedRawMaterials)
  const totalMaterialCost = computed(() => calculation.value.totalMaterialCost)
  const remainingMaterialCost = computed(() => calculation.value.remainingMaterialCost)
  const totalGoldCost = computed(() => calculation.value.totalGoldCost)
  const totalCostWithoutProcs = computed(() => calculation.value.totalCostWithoutProcs)
  const expectedProcSavings = computed(() => calculation.value.expectedProcSavings)
  const expectedAverageCost = computed(() => calculation.value.expectedAverageCost)
  const totalProcSavings = computed(() => calculation.value.totalProcSavings)
  const totalOwnedSavings = computed(() => calculation.value.totalOwnedSavings)
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
    ownedMaterials,
    forceCraftSubMaterials,
    hasOwnedMaterials,
    skippableStages,
    setCurrentStage,
    setTargetStage,
    toggleProcSkip,
    setProcSkip,
    resetProcSkips,
    toggleForceCraftSubMaterials,
    getStageOwnedMaterial,
    setStageOwnedMaterial,
    setTotalOwnedMaterial,
    resetOwnedMaterials,
    calculation,
    steps,
    activeSteps,
    skippedSteps,
    aggregatedMaterials,
    expandedRawMaterials,
    totalMaterialCost,
    remainingMaterialCost,
    totalGoldCost,
    totalCostWithoutProcs,
    expectedProcSavings,
    expectedAverageCost,
    totalProcSavings,
    totalOwnedSavings,
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
